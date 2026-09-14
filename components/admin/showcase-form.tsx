'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { SHOWCASE_TAGS, metricsToText } from '@/lib/content';
import { CoverPicker, uploadCover, validateCoverFile } from '@/components/admin/cover-picker';
import type { ActionResult } from '@/lib/services/admin-actions';
import type { ShowcaseCase } from '@/lib/types';

const SECTION_HELP =
  'One blank line starts a new paragraph. "## " makes a heading, "- " makes a bullet list.';

export function ShowcaseForm({
  item,
  action,
  submitLabel,
}: {
  item?: ShowcaseCase;
  action: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <form
      className="card"
      style={{ maxWidth: 780 }}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        if (coverFile) {
          const error = validateCoverFile(coverFile);
          if (error) {
            setResult({ ok: false, message: error });
            return;
          }
        }

        const typedUrl = String(formData.get('cover_url') ?? '').trim();
        const shouldUpload = Boolean(coverFile) || (!!typedUrl && typedUrl !== (item?.cover_url ?? ''));

        startTransition(async () => {
          try {
            if (shouldUpload) {
              setUploading(true);
              formData.set('cover_url', await uploadCover(coverFile ?? typedUrl));
            }
            formData.delete('cover_file');

            const res = await action(formData);
            setResult(res);
            if (res.ok) {
              if (item) router.refresh();
              else router.push('/admin/showcase');
            }
          } catch (error) {
            setResult({
              ok: false,
              message: error instanceof Error ? error.message : 'The cover could not be uploaded.',
            });
          } finally {
            setUploading(false);
          }
        });
      }}
    >
      {result && (
        <div
          className={`alert ${result.ok ? 'alert-ok' : 'alert-error'}`}
          role={result.ok ? 'status' : 'alert'}
          aria-live="polite"
        >
          {result.message}
        </div>
      )}

      <div className="card-title">Campaign</div>

      <div className="fg-row">
        <div className="fg">
          <label htmlFor="brand">Brand *</label>
          <input id="brand" name="brand" required defaultValue={item?.brand} placeholder="LuminaSkin" />
        </div>
        <div className="fg">
          <label htmlFor="tag">Card tag *</label>
          <select id="tag" name="tag" defaultValue={item?.tag ?? SHOWCASE_TAGS[0]}>
            {SHOWCASE_TAGS.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="fg">
        <label htmlFor="title">Campaign title *</label>
        <input
          id="title"
          name="title"
          required
          defaultValue={item?.title}
          placeholder="30-sec testimonial — TikTok campaign"
        />
      </div>

      <div className="fg-row">
        <div className="fg">
          <label htmlFor="platform">Platform</label>
          <input
            id="platform"
            name="platform"
            defaultValue={item?.platform ?? ''}
            placeholder="TikTok + Meta"
          />
        </div>
        <div className="fg">
          <label htmlFor="meta">Card stat line</label>
          <input
            id="meta"
            name="meta"
            defaultValue={item?.meta ?? ''}
            placeholder="14 creators · 2.1M views"
          />
        </div>
      </div>

      <div className="fg-row">
        <div className="fg">
          <label htmlFor="slug">URL slug</label>
          <input
            id="slug"
            name="slug"
            defaultValue={item?.slug ?? ''}
            placeholder="Leave empty to build it from brand + title"
          />
          <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
            Public address: /showcase/{item?.slug ?? '…'}
          </span>
        </div>
        <div className="fg">
          <label htmlFor="sort_order">Sort order</label>
          <input
            id="sort_order"
            name="sort_order"
            type="number"
            defaultValue={item?.sort_order ?? 0}
          />
          <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
            Lower numbers come first in the showcase grid.
          </span>
        </div>
      </div>

      <div className="fg">
        <label htmlFor="summary">Summary</label>
        <textarea
          id="summary"
          name="summary"
          rows={3}
          defaultValue={item?.summary ?? ''}
          placeholder="One or two sentences shown as the lead paragraph of the case study."
        />
      </div>

      <div className="card-title" style={{ marginTop: 8 }}>Story</div>

      <div className="fg">
        <label htmlFor="challenge">The challenge</label>
        <textarea id="challenge" name="challenge" rows={5} defaultValue={item?.challenge ?? ''} />
      </div>

      <div className="fg">
        <label htmlFor="approach">What we ran</label>
        <textarea id="approach" name="approach" rows={5} defaultValue={item?.approach ?? ''} />
      </div>

      <div className="fg">
        <label htmlFor="outcome">The result</label>
        <textarea id="outcome" name="outcome" rows={5} defaultValue={item?.outcome ?? ''} />
        <span style={{ fontSize: 11, color: 'var(--muted2)' }}>{SECTION_HELP}</span>
      </div>

      <div className="fg">
        <label htmlFor="metrics">Metric tiles</label>
        <textarea
          id="metrics"
          name="metrics"
          rows={5}
          defaultValue={metricsToText(item?.metrics)}
          placeholder={'Creators booked: 14\nOrganic views: 2.1M\nClick-through rate: 2.4%'}
        />
        <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
          One &ldquo;Label: Value&rdquo; per line. Four tiles fit the row exactly.
        </span>
      </div>

      <div className="card-title" style={{ marginTop: 8 }}>Cover image</div>

      <CoverPicker
        currentUrl={item?.cover_url ?? null}
        onFileChange={setCoverFile}
        hint="Shown on the showcase card and at the top of the case study."
      />

      <div className="fg-row">
        <div className="fg">
          <label htmlFor="emoji">Fallback emoji</label>
          <input id="emoji" name="emoji" maxLength={4} defaultValue={item?.emoji ?? '🎬'} />
        </div>
        <div className="fg">
          <label htmlFor="accent_bg">Card tint</label>
          <input
            id="accent_bg"
            name="accent_bg"
            defaultValue={item?.accent_bg ?? ''}
            placeholder="#F2ECEE"
          />
        </div>
      </div>

      <div className="card-title" style={{ marginTop: 8 }}>Publishing</div>

      <div className="fg">
        <label htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={item?.status ?? 'draft'}>
          <option value="draft">Draft — only visible here</option>
          <option value="published">Published — live on the public site</option>
        </select>
      </div>

      <div className="row gap-6">
        <button className="btn btn-primary" type="submit" disabled={pending || uploading}>
          {uploading ? 'Uploading cover…' : pending ? 'Saving…' : submitLabel}
        </button>
        <Link href="/admin/showcase" className="btn btn-ghost">Cancel</Link>
        {item?.status === 'published' && (
          <Link href={`/showcase/${item.slug}`} target="_blank" className="btn btn-ghost">
            View on site ↗
          </Link>
        )}
      </div>
    </form>
  );
}
