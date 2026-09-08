'use client';

import { useState, type ReactNode } from 'react';

export interface FieldDef {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'url' | 'tel' | 'number' | 'textarea' | 'select';
  required?: boolean;
  placeholder?: string;
  options?: string[];
  defaultValue?: string;
  half?: boolean;
  rows?: number;
  hint?: string;
}

/**
 * One controlled-enough form used by every public lead surface
 * (contact, partnership, creator application). Posts JSON, renders the
 * server's validation errors, and swaps itself for a success panel.
 */
export function LeadForm({
  action,
  fields,
  submitLabel,
  successTitle,
  successBody,
  hidden,
  children,
}: {
  action: string;
  fields: FieldDef[];
  submitLabel: string;
  successTitle: string;
  successBody: ReactNode;
  hidden?: Record<string, string | null | undefined>;
  children?: ReactNode;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const entries = Object.fromEntries(new FormData(e.currentTarget).entries());
    const payload: Record<string, unknown> = { ...entries };
    for (const [k, v] of Object.entries(hidden ?? {})) if (v) payload[k] = v;
    // Drop empty optional strings so zod's `.optional()` sees undefined.
    for (const [k, v] of Object.entries(payload)) if (v === '') delete payload[k];

    try {
      const res = await fetch(action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not submit the form.');
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="form-box">
        <div className="form-title">{successTitle}</div>
        <div className="alert alert-ok">{successBody}</div>
        <button className="submit-btn" onClick={() => setDone(false)}>
          Submit another
        </button>
      </div>
    );
  }

  // Group consecutive half-width fields into pairs.
  const rows: FieldDef[][] = [];
  for (const f of fields) {
    const last = rows[rows.length - 1];
    if (f.half && last?.length === 1 && last[0]!.half) last.push(f);
    else rows.push([f]);
  }

  return (
    <form className="form-box" onSubmit={onSubmit}>
      {children}
      {error && <div className="alert alert-error">{error}</div>}

      {rows.map((row, i) => (
        <div className={row.length === 2 ? 'fg2' : ''} key={i}>
          {row.map((f) => (
            <div className="fg" key={f.name}>
              <label htmlFor={f.name}>
                {f.label} {f.required && '*'}
              </label>
              {f.type === 'textarea' ? (
                <textarea
                  id={f.name}
                  name={f.name}
                  rows={f.rows ?? 4}
                  required={f.required}
                  placeholder={f.placeholder}
                  defaultValue={f.defaultValue}
                />
              ) : f.type === 'select' ? (
                <select id={f.name} name={f.name} required={f.required} defaultValue={f.defaultValue ?? ''}>
                  <option value="">Select…</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  id={f.name}
                  name={f.name}
                  type={f.type ?? 'text'}
                  required={f.required}
                  placeholder={f.placeholder}
                  defaultValue={f.defaultValue}
                />
              )}
              {f.hint && (
                <span style={{ fontSize: 11, color: 'var(--muted2)' }}>{f.hint}</span>
              )}
            </div>
          ))}
        </div>
      ))}

      <button className="submit-btn" type="submit" disabled={submitting}>
        {submitting ? 'Sending…' : submitLabel}
      </button>
    </form>
  );
}
