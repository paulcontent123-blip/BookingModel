'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Loads the demo dataset into the active database (used after connecting Supabase). */
export function SeedButton({ creatorCount }: { creatorCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function seed(force: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/seed${force ? '?force=true' : ''}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Seed failed.');
      setMessage({
        ok: true,
        text: `Seeded ${data.storage}: ${data.counts.creators} creators, ${data.counts.campaigns} campaigns, ${data.counts.users} accounts.`,
      });
      router.refresh();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Seed failed.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {message && (
        <div className={`alert ${message.ok ? 'alert-ok' : 'alert-warn'}`}>{message.text}</div>
      )}
      <div className="btn-row">
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => seed(false)}>
          {busy ? 'Seeding…' : 'Seed demo data'}
        </button>
        {creatorCount > 0 && (
          <button
            className="btn btn-ghost btn-sm"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`The database already has ${creatorCount} creators. Seeding again creates duplicates. Continue?`)) {
                void seed(true);
              }
            }}
          >
            Force re-seed
          </button>
        )}
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--muted2)', marginTop: 8 }}>
        Loads the 40-creator demo roster, open campaigns and the demo accounts listed in{' '}
        <code>.env.local</code>. Run this once after connecting a fresh Supabase database.
      </p>
    </div>
  );
}
