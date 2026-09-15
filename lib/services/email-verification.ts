import 'server-only';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { config } from '@/lib/config';
import { db } from '@/lib/db';
import { brandVerificationEmail, sendEmail } from '@/lib/email';
import type { User } from '@/lib/types';

export const EMAIL_VERIFICATION_TTL_MINUTES = 10;
const CODE_TTL_MS = EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

export function normalizeVerificationEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashCode(userId: string, code: string): string {
  return createHmac('sha256', config.auth.secret)
    .update(userId + ':' + code)
    .digest('hex');
}

function matchesHash(expected: string, actual: string): boolean {
  const expectedBytes = Buffer.from(expected, 'hex');
  const actualBytes = Buffer.from(actual, 'hex');
  return (
    expectedBytes.length > 0 &&
    expectedBytes.length === actualBytes.length &&
    timingSafeEqual(expectedBytes, actualBytes)
  );
}

function createCode(): string {
  return randomInt(100000, 1000000).toString();
}

export async function issueVerificationCode(
  user: User,
): Promise<{ ok: boolean; error?: string; retryAfterSeconds?: number }> {
  const sentAt = user.verification_sent_at ? Date.parse(user.verification_sent_at) : NaN;
  if (Number.isFinite(sentAt)) {
    const remaining = RESEND_COOLDOWN_MS - (Date.now() - sentAt);
    if (remaining > 0) {
      return {
        ok: false,
        error: 'Please wait ' + Math.ceil(remaining / 1000) + ' seconds before requesting another code.',
        retryAfterSeconds: Math.ceil(remaining / 1000),
      };
    }
  }

  const code = createCode();
  const now = new Date();
  const updated = await db.update('users', user.id, {
    verification_code_hash: hashCode(user.id, code),
    verification_expires_at: new Date(now.getTime() + CODE_TTL_MS).toISOString(),
    verification_sent_at: now.toISOString(),
    verification_attempts: 0,
  });

  if (!updated) {
    return { ok: false, error: 'We could not start email verification. Please try again.' };
  }

  const sent = await sendEmail(
    brandVerificationEmail(user.email, user.full_name, code),
    { type: 'user', id: user.id },
  );
  if (!sent.ok) {
    return { ok: false, error: 'We could not send the verification email. Please try again.' };
  }

  return { ok: true };
}

export async function verifyEmailCode(
  email: string,
  code: string,
): Promise<{ user: User | null; error?: string }> {
  if (!/^\d{6}$/.test(code)) {
    return { user: null, error: 'Enter the 6-digit verification code.' };
  }

  const user = await db.findOne('users', { email: normalizeVerificationEmail(email) });
  if (!user) {
    return { user: null, error: 'The verification code is invalid or expired.' };
  }
  if (user.is_verified) {
    return { user: null, error: 'This email is already verified. Please sign in.' };
  }

  const attempts = user.verification_attempts ?? 0;
  if (attempts >= MAX_ATTEMPTS) {
    return { user: null, error: 'Too many incorrect attempts. Request a new code.' };
  }

  const expiresAt = user.verification_expires_at ? Date.parse(user.verification_expires_at) : NaN;
  if (!user.verification_code_hash || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return { user: null, error: 'This verification code has expired. Request a new one.' };
  }

  const actualHash = hashCode(user.id, code);
  if (!matchesHash(user.verification_code_hash, actualHash)) {
    const nextAttempts = attempts + 1;
    await db.update('users', user.id, { verification_attempts: nextAttempts });
    return {
      user: null,
      error:
        nextAttempts >= MAX_ATTEMPTS
          ? 'Too many incorrect attempts. Request a new code.'
          : 'That verification code is incorrect.',
    };
  }

  const verified = await db.update('users', user.id, {
    is_verified: true,
    verification_code_hash: null,
    verification_expires_at: null,
    verification_sent_at: null,
    verification_attempts: 0,
  });

  return verified
    ? { user: verified }
    : { user: null, error: 'We could not verify your email. Please try again.' };
}
