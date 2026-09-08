'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireUser, revealCreatorContact } from '@/lib/auth';
import { lowestPlanWith, planName, revealLimitLabel } from '@/lib/plans';

export interface RevealActionResult {
  ok: boolean;
  message: string;
}

/**
 * Spends one daily contact reveal on a creator.
 *
 * This is the only entry point that unlocks a contact, so the daily quota is
 * actually consumed. Revealing the same creator twice in one day is free — the
 * quota limits how many distinct creators a brand may unlock per day.
 */
export async function revealContactAction(formData: FormData): Promise<RevealActionResult> {
  const user = await requireUser('/login?next=/dashboard/creators');
  const creatorId = String(formData.get('creator_id') ?? '').trim();
  if (!creatorId) return { ok: false, message: 'Missing creator.' };

  const creator = await db.get('creators', creatorId);
  if (!creator || creator.status !== 'active') {
    return { ok: false, message: 'That creator is no longer on the roster.' };
  }

  const outcome = await revealCreatorContact(user, creatorId);

  if (!outcome.ok) {
    if (outcome.reason === 'plan_locked') {
      const needed = lowestPlanWith('contact_reveals');
      return {
        ok: false,
        message: `Contact details start on the ${planName(needed ?? 'standard')} plan.`,
      };
    }
    if (outcome.reason === 'quota_exhausted') {
      return {
        ok: false,
        message: `You have used all ${revealLimitLabel(user.plan)} reveals for today. The quota resets at midnight UTC.`,
      };
    }
    return { ok: false, message: 'Please sign in again.' };
  }

  revalidatePath('/dashboard/creators');
  revalidatePath('/dashboard');

  return {
    ok: true,
    message: outcome.alreadyRevealed
      ? 'Already unlocked today — no reveal used.'
      : `Contact unlocked for ${creator.name}.`,
  };
}
