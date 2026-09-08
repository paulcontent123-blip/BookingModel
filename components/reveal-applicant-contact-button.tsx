'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { revealApplicantContactAction } from '@/lib/services/contact-actions';

export function RevealApplicantContactButton({
  applicantId,
  applicantName,
}: {
  applicantId: string;
  applicantName: string;
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
            data.set('applicant_id', applicantId);
            const result = await revealApplicantContactAction(data);
            setError(result.ok ? null : result.message);
            if (result.ok) router.refresh();
          });
        }}
      >
        {pending ? 'Unlocking…' : '🔓 Reveal contact'}
      </button>
      <span className="brand-creator-contact-hint">
        {error ?? `Uses 1 of today's reveals for ${applicantName}`}
      </span>
    </div>
  );
}
