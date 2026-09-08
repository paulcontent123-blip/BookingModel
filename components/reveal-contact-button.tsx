'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { revealContactAction } from '@/lib/services/contact-actions';

/**
 * Spends one daily contact reveal on a single creator.
 *
 * Deliberately one creator at a time: the plan sells "10 creators a day", so
 * the list must not hand out twenty contacts in one page load.
 */
export function RevealContactButton({
  creatorId,
  creatorName,
}: {
  creatorId: string;
  creatorName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="brand-creator-contact reveal">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const data = new FormData();
            data.set('creator_id', creatorId);
            const result = await revealContactAction(data);
            setError(result.ok ? null : result.message);
            if (result.ok) router.refresh();
          });
        }}
      >
        {pending ? 'Unlocking…' : '🔓 Reveal contact'}
      </button>
      <span className="brand-creator-contact-hint">
        {error ?? `Uses 1 of today's reveals for ${creatorName}`}
      </span>
    </div>
  );
}
