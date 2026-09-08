'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { ActionResult } from '@/lib/services/admin-actions';

/**
 * Wraps a server action in a button with pending state, an inline result
 * message and an optional confirmation prompt.
 */
export function ActionButton({
  action,
  label,
  pendingLabel,
  className = 'btn btn-ghost btn-xs',
  confirm,
}: {
  action: () => Promise<ActionResult>;
  label: string;
  pendingLabel?: string;
  className?: string;
  confirm?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <>
      <button
        className={className}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          startTransition(async () => {
            const res = await action();
            setResult(res);
            if (res.ok) router.refresh();
          });
        }}
      >
        {pending ? (pendingLabel ?? 'Working…') : label}
      </button>
      {result && !result.ok && (
        <span style={{ fontSize: 11, color: 'var(--red)', marginLeft: 6 }}>{result.message}</span>
      )}
    </>
  );
}

/** Inline <select> that fires a server action on change. */
export function ActionSelect({
  value,
  options,
  action,
}: {
  value: string;
  options: string[];
  action: (next: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={value}
      disabled={pending}
      style={{
        padding: '4px 8px',
        border: '1.5px solid var(--border)',
        borderRadius: 5,
        fontSize: 12,
        fontFamily: 'var(--mont)',
        background: 'var(--white)',
      }}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(async () => {
          await action(next);
          router.refresh();
        });
      }}
    >
      {options.map((o) => (
        <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>
      ))}
    </select>
  );
}
