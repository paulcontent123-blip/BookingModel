import 'server-only';

import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { resolve4, resolve6, resolveMx } from 'node:dns/promises';
import { config } from '@/lib/config';
import { requestEmailVerificationEmail, sendEmail } from '@/lib/email';
import { db } from '@/lib/db';
import type { PublicRequestType, RequestEmailVerification } from '@/lib/types';

export const REQUEST_EMAIL_VERIFICATION_TTL_MINUTES = 10;
const CODE_TTL_MS = REQUEST_EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const DNS_LOOKUP_TIMEOUT_MS = 4000;

const REQUEST_LABELS: Record<PublicRequestType, string> = {
  contact: 'contact request',
  partnership: 'partnership request',
  booking_request: 'booking assistance request',
  applicant: 'creator application',
};

export function normalizeRequestEmail(email: string): string {
  return email.trim().toLowerCase();
}

type EmailDomainCheck =
  | { ok: true }
  | { ok: false; error: string };

function withDnsTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('DNS lookup timed out.')), DNS_LOOKUP_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Check whether the email domain publishes a route that can receive mail.
 *
 * This intentionally does not claim that the mailbox before `@` exists — only
 * the mailbox provider can confirm that, and the OTP remains the final proof.
 * A null MX record (for example, a typo domain that explicitly refuses mail)
 * is rejected before an OTP row or email is created.
 */
async function checkEmailDomain(email: string): Promise<EmailDomainCheck> {
  const at = email.lastIndexOf('@');
  const domain = at >= 0 ? email.slice(at + 1).trim() : '';
  if (!domain || domain.includes('..') || domain.startsWith('.') || domain.endsWith('.')) {
    return {
      ok: false,
      error: 'That email address is not valid. Please check it and enter a real email address.',
    };
  }

  try {
    const mxRecords = await withDnsTimeout(resolveMx(domain));
    const mailHosts = mxRecords.filter((record) => record.exchange !== '.');
    if (mailHosts.length > 0) return { ok: true };

    // RFC 7505 null MX means the domain explicitly cannot receive email.
    return {
      ok: false,
      error: 'That email domain cannot receive email. Please check the address and try again.',
    };
  } catch {
    // Domains without an MX record may still accept mail through their A/AAAA
    // record. Only allow that RFC fallback when the domain resolves.
    try {
      await Promise.any([
        withDnsTimeout(resolve4(domain)),
        withDnsTimeout(resolve6(domain)),
      ]);
      return { ok: true };
    } catch {
      return {
        ok: false,
        error: 'That email domain does not appear to exist. Please check the address and try again.',
      };
    }
  }
}

function createCode(): string {
  return randomInt(100000, 1000000).toString();
}

function hashCode(verificationId: string, code: string): string {
  return createHmac('sha256', config.auth.secret)
    .update(`${verificationId}:${code}`)
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

function remainingCooldown(sentAt: string | null | undefined): number {
  const timestamp = sentAt ? Date.parse(sentAt) : NaN;
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, RESEND_COOLDOWN_MS - (Date.now() - timestamp));
}

export async function startRequestEmailVerification(
  type: PublicRequestType,
  email: string,
  payload: Record<string, unknown>,
): Promise<
  | { ok: true; verificationId: string; email: string }
  | { ok: false; error: string; retryAfterSeconds?: number; invalidEmail?: boolean }
> {
  const normalizedEmail = normalizeRequestEmail(email);
  const domainCheck = await checkEmailDomain(normalizedEmail);
  if (!domainCheck.ok) {
    return { ok: false, invalidEmail: true, error: domainCheck.error };
  }

  const latest = await db.list('request_email_verifications', {
    where: { email: normalizedEmail },
    orderBy: 'created_at',
    ascending: false,
    limit: 1,
  });
  const existing = latest[0];
  const cooldown = remainingCooldown(existing?.sent_at);
  if (existing && !existing.verified_at && cooldown > 0) {
    return {
      ok: false,
      error: `Please wait ${Math.ceil(cooldown / 1000)} seconds before requesting another code.`,
      retryAfterSeconds: Math.ceil(cooldown / 1000),
    };
  }

  const verificationId = randomUUID();
  const code = createCode();
  const now = new Date();
  const pending = await db.insert('request_email_verifications', {
    id: verificationId,
    request_type: type,
    email: normalizedEmail,
    payload,
    code_hash: hashCode(verificationId, code),
    expires_at: new Date(now.getTime() + CODE_TTL_MS).toISOString(),
    sent_at: now.toISOString(),
    attempts: 0,
    verified_at: null,
    created_at: now.toISOString(),
  });

  const sent = await sendEmail(
    requestEmailVerificationEmail(normalizedEmail, code, REQUEST_LABELS[type]),
    { type: 'request_email_verification', id: pending.id },
  );
  if (!sent.ok) {
    await db.remove('request_email_verifications', pending.id);
    return { ok: false, error: 'We could not send the verification email. Please try again.' };
  }

  return { ok: true, verificationId: pending.id, email: normalizedEmail };
}

export async function resendRequestEmailVerification(
  verificationId: string,
): Promise<
  | { ok: true; email: string }
  | { ok: false; error: string; retryAfterSeconds?: number; invalidEmail?: boolean }
> {
  const pending = await db.get('request_email_verifications', verificationId);
  if (!pending || pending.verified_at) {
    return { ok: false, error: 'This verification request is no longer available. Please submit the form again.' };
  }

  const domainCheck = await checkEmailDomain(pending.email);
  if (!domainCheck.ok) {
    return { ok: false, invalidEmail: true, error: domainCheck.error };
  }

  const cooldown = remainingCooldown(pending.sent_at);
  if (cooldown > 0) {
    return {
      ok: false,
      error: `Please wait ${Math.ceil(cooldown / 1000)} seconds before requesting another code.`,
      retryAfterSeconds: Math.ceil(cooldown / 1000),
    };
  }

  const code = createCode();
  const now = new Date();
  const updated = await db.update('request_email_verifications', verificationId, {
    code_hash: hashCode(verificationId, code),
    expires_at: new Date(now.getTime() + CODE_TTL_MS).toISOString(),
    sent_at: now.toISOString(),
    attempts: 0,
  });
  if (!updated) return { ok: false, error: 'We could not start email verification. Please try again.' };

  const sent = await sendEmail(
    requestEmailVerificationEmail(pending.email, code, REQUEST_LABELS[pending.request_type]),
    { type: 'request_email_verification', id: verificationId },
  );
  if (!sent.ok) {
    await db.update('request_email_verifications', verificationId, {
      code_hash: pending.code_hash,
      expires_at: pending.expires_at,
      sent_at: pending.sent_at,
      attempts: pending.attempts,
    });
    return { ok: false, error: 'We could not send the verification email. Please try again.' };
  }

  return { ok: true, email: pending.email };
}

export async function verifyRequestEmailCode(
  verificationId: string,
  code: string,
): Promise<{ ok: true; pending: RequestEmailVerification } | { ok: false; error: string }> {
  if (!/^\d{6}$/.test(code)) return { ok: false, error: 'Enter the 6-digit verification code.' };

  const pending = await db.get('request_email_verifications', verificationId);
  if (!pending || pending.verified_at) {
    return { ok: false, error: 'This verification request is invalid or has already been completed.' };
  }

  if (pending.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: 'Too many incorrect attempts. Request a new code.' };
  }

  const expiresAt = Date.parse(pending.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return { ok: false, error: 'This verification code has expired. Request a new one.' };
  }

  if (!matchesHash(pending.code_hash, hashCode(verificationId, code))) {
    const attempts = pending.attempts + 1;
    await db.update('request_email_verifications', verificationId, { attempts });
    return {
      ok: false,
      error: attempts >= MAX_ATTEMPTS
        ? 'Too many incorrect attempts. Request a new code.'
        : 'That verification code is incorrect.',
    };
  }

  const verified = await db.update('request_email_verifications', verificationId, {
    verified_at: new Date().toISOString(),
  });
  return verified
    ? { ok: true, pending: verified }
    : { ok: false, error: 'We could not verify your email. Please try again.' };
}
