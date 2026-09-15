'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { CoverPicker, uploadCover, validateCoverFile } from '@/components/admin/cover-picker';
import type { ActionResult } from '@/lib/services/admin-actions';
import type { Partner } from '@/lib/types';

export function PartnerForm({
  partner,
  action,
  submitLabel,
}: {
  partner?: Partner;
  action: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <form
      className="card"
      style={{ maxWidth: 780 }}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        if (logoFile) {
          const error = validateCoverFile(logoFile);
          if (error) {
            setResult({ ok: false, message: error });
            return;
          }
        }

        const typedUrl = String(formData.get('cover_url') ?? '').trim();
        const shouldUpload = Boolean(logoFile) || (!!typedUrl && typedUrl !== (partner?.logo_url ?? ''));

        startTransition(async () => {
          try {
            if (shouldUpload) {
              setUploading(true);
              formData.set('cover_url', await uploadCover(logoFile ?? typedUrl));
            }
            formData.delete('cover_file');

            const response = await action(formData);
            setResult(response);
            if (response.ok) {
              if (partner) router.refresh();
              else router.push('/admin/partners');
            }
          } catch (error) {
            setResult({
              ok: false,
              message: error instanceof Error ? error.message : 'The partner logo could not be uploaded.',
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

      <div className="card-title">Partner profile</div>

      <div className="fg">
        <label htmlFor="name">Partner name *</label>
        <input
          id="name"
          name="name"
          required
          maxLength={160}
          defaultValue={partner?.name ?? ''}
          placeholder="Creator agency, technology platform or brand"
        />
      </div>

      <div className="fg-row">
        <div className="fg">
          <label htmlFor="category">Category</label>
          <input
            id="category"
            name="category"
            maxLength={100}
            defaultValue={partner?.category ?? ''}
            placeholder="Technology partner"
          />
        </div>
        <div className="fg">
          <label htmlFor="sort_order">Display order</label>
          <input
            id="sort_order"
            name="sort_order"
            type="number"
            defaultValue={partner?.sort_order ?? 0}
          />
          <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
            Lower numbers appear first.
          </span>
        </div>
      </div>

      <div className="fg-row">
        <div className="fg">
          <label htmlFor="icon">Card icon</label>
          <input
            id="icon"
            name="icon"
            maxLength={16}
            defaultValue={partner?.icon ?? ''}
            placeholder="🤝"
          />
        </div>
        <div className="fg">
          <label htmlFor="cta_label">Card action label</label>
          <input
            id="cta_label"
            name="cta_label"
            maxLength={80}
            defaultValue={partner?.cta_label ?? ''}
            placeholder="Reach out →"
          />
        </div>
      </div>

      <div className="fg">
        <label htmlFor="website_url">Website URL</label>
        <input
          id="website_url"
          name="website_url"
          type="url"
          defaultValue={partner?.website_url ?? ''}
          placeholder="https://partner.example"
        />
      </div>

      <div className="fg">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          rows={4}
          maxLength={1000}
          defaultValue={partner?.description ?? ''}
          placeholder="A short description shown to visitors on the Partnership page."
        />
      </div>

      <div className="card-title" style={{ marginTop: 8 }}>Partner logo</div>

      <CoverPicker
        currentUrl={partner?.logo_url ?? null}
        onFileChange={setLogoFile}
        label="partner logo"
        previewAlt="Partner logo preview"
        hint="Use a square or transparent logo. It will be uploaded to Cloudinary before saving."
      />

      <div className="card-title" style={{ marginTop: 8 }}>Visibility</div>

      <div className="fg">
        <label htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={partner?.status ?? 'draft'}>
          <option value="draft">Draft — hidden from the public page</option>
          <option value="published">Published — visible on the public page</option>
        </select>
      </div>

      <div className="row gap-6">
        <button className="btn btn-primary" type="submit" disabled={pending || uploading}>
          {uploading ? 'Uploading logo…' : pending ? 'Saving…' : submitLabel}
        </button>
        <Link href="/admin/partners" className="btn btn-ghost">Cancel</Link>
        {partner?.website_url && (
          <a href={partner.website_url} target="_blank" rel="noreferrer" className="btn btn-ghost">
            Visit website ↗
          </a>
        )}
      </div>
    </form>
  );
}
