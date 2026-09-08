import 'server-only';
import { config } from '@/lib/config';
import { db } from '@/lib/db';
import type { Message } from './templates';

export * from './templates';

/**
 * Email delivery.
 *
 *  RESEND_API_KEY set  -> delivered through Resend
 *  no key              -> written to the server console AND to `email_log`,
 *                         which Admin → Email log renders, so the whole
 *                         notification flow is verifiable without a key.
 *
 * Sending never throws: a failed notification must not roll back a paid
 * booking. Failures are recorded in email_log with status 'failed'.
 */

export interface SendResult {
  ok: boolean;
  provider: string;
  id: string | null;
  error?: string;
}

async function record(
  msg: Message,
  result: { provider: string; id: string | null; status: 'sent' | 'failed' | 'logged'; error?: string },
  related?: { type: string; id: string },
): Promise<void> {
  try {
    await db.insert('email_log', {
      to_email: msg.to,
      from_email: config.email.from,
      subject: msg.subject,
      template: msg.template,
      html: msg.html,
      provider: result.provider,
      provider_id: result.id,
      status: result.status,
      error: result.error ?? null,
      related_type: related?.type ?? null,
      related_id: related?.id ?? null,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[email] could not write email_log:', err);
  }
}

export async function sendEmail(
  msg: Message,
  related?: { type: string; id: string },
): Promise<SendResult> {
  if (!msg.to) {
    await record(msg, { provider: 'none', id: null, status: 'failed', error: 'No recipient address' }, related);
    return { ok: false, provider: 'none', id: null, error: 'No recipient address' };
  }

  if (!config.email.enabled) {
    console.info(
      `\n📧 [email:dev] to=${msg.to}\n   subject=${msg.subject}\n   template=${msg.template}\n   (set RESEND_API_KEY to deliver for real — logged to Admin → Email log)\n`,
    );
    await record(msg, { provider: 'console', id: null, status: 'logged' }, related);
    return { ok: true, provider: 'console', id: null };
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(config.email.resendKey);
    const { data, error } = await resend.emails.send({
      from: config.email.from,
      to: msg.to,
      replyTo: config.email.replyTo,
      subject: msg.subject,
      html: msg.html,
    });

    if (error) {
      console.error('[email] Resend error:', error);
      await record(msg, { provider: 'resend', id: null, status: 'failed', error: error.message }, related);
      return { ok: false, provider: 'resend', id: null, error: error.message };
    }

    await record(msg, { provider: 'resend', id: data?.id ?? null, status: 'sent' }, related);
    return { ok: true, provider: 'resend', id: data?.id ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[email] send failed:', message);
    await record(msg, { provider: 'resend', id: null, status: 'failed', error: message }, related);
    return { ok: false, provider: 'resend', id: null, error: message };
  }
}

/** Fire several messages without letting one failure block the others. */
export async function sendAll(
  messages: Message[],
  related?: { type: string; id: string },
): Promise<SendResult[]> {
  return Promise.all(messages.map((m) => sendEmail(m, related)));
}
