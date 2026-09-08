import 'server-only';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { config } from './config';
import { db } from './db';
import {
  dailyRevealLimit,
  isUnlimitedReveals,
  planHasFeature,
  type PlanFeature,
} from './plans';
import type { Plan, Role, User } from './types';

/**
 * Self-contained email/password auth on the `users` table.
 *
 * Chosen over Supabase Auth so the app works before any key exists. To migrate
 * later: keep this module's public surface, swap the two functions marked
 * MIGRATION POINT for `supabase.auth.signInWithPassword` / `getUser`.
 */

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  plan: Plan;
  full_name: string | null;
  company_name: string | null;
}

const secret = new TextEncoder().encode(config.auth.secret);

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain: string, hash: string | null): boolean {
  if (!hash) return false;
  return bcrypt.compareSync(plain, hash);
}

async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${config.auth.maxAgeSeconds}s`)
    .sign(secret);
}

async function readSession(cookieName: string): Promise<SessionUser | null> {
  try {
    const jar = await cookies();
    const token = jar.get(cookieName)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, secret);
    if (!payload.id || !payload.email) return null;

    return {
      id: String(payload.id),
      email: String(payload.email),
      role: (payload.role as Role) ?? 'brand',
      plan: (payload.plan as Plan) ?? 'free',
      full_name: (payload.full_name as string) ?? null,
      company_name: (payload.company_name as string) ?? null,
    };
  } catch {
    return null;
  }
}

export function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    plan: user.plan,
    full_name: user.full_name,
    company_name: user.company_name,
  };
}

export async function createSession(user: User): Promise<void> {
  if (user.role === 'admin') {
    throw new Error('Admin accounts must use the internal admin session.');
  }

  const token = await signSession(toSessionUser(user));
  const jar = await cookies();
  jar.set(config.auth.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: config.auth.maxAgeSeconds,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(config.auth.cookieName);
  // Remove the pre-split cookie as well, so existing browsers do not retain
  // an old session after upgrading to the separated brand/admin auth flows.
  jar.delete('bm_session');
}

/** Current signed-in user, or null. Never throws. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const user = await readSession(config.auth.cookieName);
  // An old admin token must never become a public/brand session.
  if (!user || user.role === 'admin') return null;

  // Keep plan/role changes effective without requiring a stale JWT to expire.
  // This is important for server-side plan gates such as creator contact access.
  try {
    const current = await db.get('users', user.id);
    if (current) {
      return current.role === 'admin' ? null : toSessionUser(current);
    }
  } catch {
    // Fall back to the signed session if the database is temporarily unavailable.
  }

  return user;
}

/** Current internal admin session, or null. Never reads the brand cookie. */
export async function getAdminSessionUser(): Promise<SessionUser | null> {
  const user = await readSession(config.auth.adminCookieName);
  return user?.role === 'admin' ? user : null;
}

export async function createAdminSession(user: User): Promise<void> {
  if (user.role !== 'admin') {
    throw new Error('Only admin accounts can create an internal session.');
  }

  const token = await signSession(toSessionUser(user));
  const jar = await cookies();
  jar.set(config.auth.adminCookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: config.auth.maxAgeSeconds,
  });
}

export async function destroyAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(config.auth.adminCookieName);
}

/** MIGRATION POINT — swap for supabase.auth.signInWithPassword. */
export async function authenticate(email: string, password: string): Promise<User | null> {
  const user = await db.findOne('users', { email: email.trim().toLowerCase() });
  if (!user) return null;
  if (!verifyPassword(password, user.password_hash)) return null;
  return user;
}

export async function registerUser(input: {
  email: string;
  password: string;
  full_name?: string;
  company_name?: string;
  role?: Role;
  country?: string | null;
}): Promise<{ user: User | null; error?: string }> {
  const email = input.email.trim().toLowerCase();
  const existing = await db.findOne('users', { email });
  if (existing) return { user: null, error: 'An account with this email already exists.' };

  const user = await db.insert('users', {
    email,
    password_hash: hashPassword(input.password),
    full_name: input.full_name ?? null,
    company_name: input.company_name ?? null,
    role: input.role ?? 'brand',
    country: input.country ?? null,
    // Every newly registered Brand starts on Free; upgrading is explicit.
    plan: 'free',
    is_verified: false,
    stripe_customer_id: null,
    created_at: new Date().toISOString(),
  });

  return { user };
}

/** Throws a redirect when the visitor is not signed in. */
export async function requireUser(redirectTo = '/login'): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const { redirect } = await import('next/navigation');
    redirect(redirectTo);
  }
  return user!;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getAdminSessionUser();
  if (!user) {
    const { redirect } = await import('next/navigation');
    redirect('/admin/login?next=/admin&error=admin_required');
  }
  return user!;
}

// ---------------------------------------------------------------------------
// Plan gates
//
// Every rule lives in lib/plans.ts. This module only enforces it and keeps the
// reveal ledger. Nothing here may hard-code a plan name or a quota.
// ---------------------------------------------------------------------------

/** Admins bypass every plan gate; they are staff, not customers. */
function isStaff(user: SessionUser | null): boolean {
  return user?.role === 'admin';
}

export function userHasFeature(user: SessionUser | null, feature: PlanFeature): boolean {
  if (!user) return false;
  if (isStaff(user)) return true;
  return planHasFeature(user.plan, feature);
}

/**
 * Throws a redirect to the plan page when the signed-in brand's plan does not
 * include `feature`. Use at the top of any page that sells a plan benefit.
 */
export async function requirePlanFeature(
  feature: PlanFeature,
  redirectTo = '/dashboard/plan',
): Promise<SessionUser> {
  const user = await requireUser();
  if (userHasFeature(user, feature)) return user;
  const { redirect } = await import('next/navigation');
  redirect(`${redirectTo}?locked=${feature}`);
  return user;
}

/**
 * Return the current UTC calendar-day window.
 *
 * We intentionally filter by created_at instead of reveal_date here. Older
 * Supabase databases created contact_reveals before the reveal_date migration
 * was applied; created_at exists in both schemas and preserves the same UTC
 * daily-quota behavior.
 */
function todayWindow(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function listRevealsToday(userId: string) {
  const { start, end } = todayWindow();
  return db.list('contact_reveals', {
    where: { user_id: userId },
    filters: [
      { column: 'created_at', op: 'gte', value: start },
      { column: 'created_at', op: 'lt', value: end },
    ],
  });
}

/** Distinct creators this account has revealed today. */
export async function dailyRevealCount(userId: string): Promise<number> {
  const rows = await listRevealsToday(userId);
  return new Set(
    rows
      .map((row) => row.creator_id ?? row.applicant_id ?? null)
      .filter((id): id is string => Boolean(id)),
  ).size;
}

/** Creator ids already unlocked today — these cost no further quota. */
export async function revealedCreatorIdsToday(userId: string): Promise<Set<string>> {
  const rows = await listRevealsToday(userId);
  return new Set(rows.map((row) => row.creator_id).filter((id): id is string => Boolean(id)));
}

/** Applicant ids this account has unlocked today. */
export async function revealedApplicantIdsToday(userId: string): Promise<Set<string>> {
  const rows = await listRevealsToday(userId);
  return new Set(rows.map((row) => row.applicant_id).filter((id): id is string => Boolean(id)));
}

export interface RevealQuota {
  limit: number;
  used: number;
  remaining: number;
  unlimited: boolean;
  /** False on Free, where contact details are not part of the plan at all. */
  entitled: boolean;
}

export async function revealQuota(user: SessionUser | null): Promise<RevealQuota> {
  if (!user) {
    return { limit: 0, used: 0, remaining: 0, unlimited: false, entitled: false };
  }

  const unlimited = isStaff(user) || isUnlimitedReveals(user.plan);
  const entitled = isStaff(user) || planHasFeature(user.plan, 'contact_reveals');
  const limit = unlimited ? Number.POSITIVE_INFINITY : dailyRevealLimit(user.plan);
  const used = entitled ? await dailyRevealCount(user.id) : 0;

  return {
    limit,
    used,
    remaining: unlimited ? Number.POSITIVE_INFINITY : Math.max(0, limit - used),
    unlimited,
    entitled,
  };
}

/**
 * May this account see `creatorId`'s contact details right now?
 *
 * A creator already revealed today stays visible even once the quota is spent —
 * the quota limits how many *new* creators a brand may unlock per day.
 */
export async function canViewContact(
  user: SessionUser | null,
  creatorId?: string,
): Promise<boolean> {
  if (!user) return false;
  if (isStaff(user)) return true;
  if (!planHasFeature(user.plan, 'contact_reveals')) return false;
  if (isUnlimitedReveals(user.plan)) return true;

  if (creatorId) {
    const revealed = await revealedCreatorIdsToday(user.id);
    if (revealed.has(creatorId)) return true;
    return revealed.size < dailyRevealLimit(user.plan);
  }

  return (await dailyRevealCount(user.id)) < dailyRevealLimit(user.plan);
}

export type RevealOutcome =
  | { ok: true; alreadyRevealed: boolean; quota: RevealQuota }
  | { ok: false; reason: 'not_signed_in' | 'plan_locked' | 'quota_exhausted'; quota: RevealQuota };

/**
 * Consumes one daily reveal for `creatorId` and records it.
 *
 * This is the only place that writes the ledger — without it the daily quota is
 * never spent, which is exactly how the previous build let a Standard account
 * read every contact on the roster.
 */
export async function revealCreatorContact(
  user: SessionUser | null,
  creatorId: string,
): Promise<RevealOutcome> {
  return revealContactTarget(user, { creatorId });
}

/** Unlocks a public creator application using the same daily reveal pool. */
export async function revealApplicantContact(
  user: SessionUser | null,
  applicantId: string,
): Promise<RevealOutcome> {
  return revealContactTarget(user, { applicantId });
}

async function revealContactTarget(
  user: SessionUser | null,
  target: { creatorId?: string; applicantId?: string },
): Promise<RevealOutcome> {
  const targetId = target.creatorId ?? target.applicantId;
  if (!targetId) {
    return {
      ok: false,
      reason: 'quota_exhausted',
      quota: await revealQuota(user),
    };
  }

  const quota = await revealQuota(user);
  if (!user) return { ok: false, reason: 'not_signed_in', quota };

  // Staff and unlimited plans are not metered, so nothing is written for them.
  if (isStaff(user) || isUnlimitedReveals(user.plan)) {
    return { ok: true, alreadyRevealed: false, quota };
  }

  if (!planHasFeature(user.plan, 'contact_reveals')) {
    return { ok: false, reason: 'plan_locked', quota };
  }

  const reveals = await listRevealsToday(user.id);
  const alreadyRevealed = reveals.some((row) =>
    target.creatorId ? row.creator_id === target.creatorId : row.applicant_id === target.applicantId,
  );
  if (alreadyRevealed) {
    return { ok: true, alreadyRevealed: true, quota };
  }

  if (quota.used >= dailyRevealLimit(user.plan)) {
    return { ok: false, reason: 'quota_exhausted', quota };
  }

  await db.insert('contact_reveals', {
    user_id: user.id,
    creator_id: target.creatorId ?? null,
    applicant_id: target.applicantId ?? null,
    created_at: new Date().toISOString(),
  });

  return { ok: true, alreadyRevealed: false, quota: await revealQuota(user) };
}
