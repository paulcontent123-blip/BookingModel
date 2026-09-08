'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { cancelPlanUpgradeAction } from '@/lib/services/plan-actions';

/** Withdraws a pending upgrade request from the plan page. */
export function CancelUpgradeButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        className="brand-plan-inline-button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await cancelPlanUpgradeAction();
            setError(result.ok ? null : result.message);
            if (result.ok) router.refresh();
          });
        }}
      >
        {pending ? 'Cancelling…' : 'Cancel request'}
      </button>
      {error && <span className="brand-plan-inline-error">{error}</span>}
    </>
  );
}
