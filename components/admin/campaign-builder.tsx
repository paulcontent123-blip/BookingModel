'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import type { ActionResult } from '@/lib/services/admin-actions';

export function CampaignBuilder({
  action,
  categories,
  contentTypes,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  categories: string[];
  contentTypes: string[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <form
      ref={formRef}
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
          const res = await action(formData);
          setResult(res);
          if (res.ok) {
            formRef.current?.reset();
            router.refresh();
          }
        });
      }}
    >
      <div className="card-title">New campaign</div>
      {result && (
        <div className={`alert ${result.ok ? 'alert-ok' : 'alert-error'}`}>{result.message}</div>
      )}

      <div className="fg">
        <label htmlFor="brand_name">Brand *</label>
        <input id="brand_name" name="brand_name" required placeholder="LuminaSkin" />
      </div>

      <div className="fg">
        <label htmlFor="title">Campaign title *</label>
        <input id="title" name="title" required placeholder="Skincare UGC — 30sec testimonial" />
      </div>

      <div className="fg-row">
        <div className="fg">
          <label htmlFor="category">Category</label>
          <select id="category" name="category" defaultValue={categories[0]}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="fg">
          <label htmlFor="content_type">Content type</label>
          <select id="content_type" name="content_type" defaultValue={contentTypes[0]}>
            {contentTypes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="fg-row">
        <div className="fg">
          <label htmlFor="platform">Platform</label>
          <input id="platform" name="platform" placeholder="TikTok + Meta" />
        </div>
        <div className="fg">
          <label htmlFor="spots_total">Spots</label>
          <input id="spots_total" name="spots_total" type="number" min={1} max={200} defaultValue={8} />
        </div>
      </div>

      <div className="fg-row">
        <div className="fg">
          <label htmlFor="rate_label">Rate label</label>
          <input id="rate_label" name="rate_label" placeholder="$80–120/video" />
        </div>
        <div className="fg">
          <label htmlFor="budget_usd">Budget (USD)</label>
          <input id="budget_usd" name="budget_usd" type="number" min={0} placeholder="5000" />
        </div>
      </div>

      <div className="fg">
        <label htmlFor="emoji">Card emoji</label>
        <input id="emoji" name="emoji" maxLength={4} defaultValue="🎬" />
      </div>

      <div className="fg">
        <label htmlFor="brief_text">Brief</label>
        <textarea id="brief_text" name="brief_text" rows={4} placeholder="What creators need to know before applying." />
      </div>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 12 }}>
        <input type="checkbox" name="publish" defaultChecked />
        Publish to the public site immediately
      </label>

      <button className="btn btn-primary" type="submit" disabled={pending} style={{ width: '100%' }}>
        {pending ? 'Saving…' : 'Create campaign'}
      </button>
    </form>
  );
}
