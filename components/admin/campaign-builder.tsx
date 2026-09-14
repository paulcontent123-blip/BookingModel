'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import type { ActionResult } from '@/lib/services/admin-actions';
import type { Campaign } from '@/lib/types';
import { uploadCover, validateCoverFile } from '@/components/admin/cover-picker';

export function CampaignBuilder({
  action,
  categories,
  contentTypes,
  campaign,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  categories: string[];
  contentTypes: string[];
  campaign?: Campaign;
  submitLabel?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(campaign?.cover_url ?? null);
  const [removeCover, setRemoveCover] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <form
      ref={formRef}
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const selectedCover = coverFile;

        if (selectedCover) {
          const error = validateCoverFile(selectedCover);
          if (error) {
            setResult({ ok: false, message: error });
            return;
          }
        }

        startTransition(async () => {
          try {
            if (selectedCover) {
              setUploading(true);
              formData.set('cover_url', await uploadCover(selectedCover));
            } else if (removeCover) {
              formData.set('cover_url', '');
            }
            formData.delete('cover_file');

            const res = await action(formData);
            setResult(res);
            if (res.ok) {
              if (campaign) {
                router.push('/admin/campaigns');
              } else {
                formRef.current?.reset();
                setCoverFile(null);
                setRemoveCover(false);
                setCoverPreview((current) => {
                  if (current) URL.revokeObjectURL(current);
                  return null;
                });
                router.refresh();
              }
            }
          } catch (error) {
            setResult({
              ok: false,
              message: error instanceof Error ? error.message : 'The campaign image could not be uploaded.',
            });
          } finally {
            setUploading(false);
          }
        });
      }}
    >
      <div className="card-title">{campaign ? 'Edit campaign' : 'New campaign'}</div>
      {result && (
        <div className={`alert ${result.ok ? 'alert-ok' : 'alert-error'}`}>{result.message}</div>
      )}

      <div className="fg">
        <label htmlFor="brand_name">Brand *</label>
        <input
          id="brand_name"
          name="brand_name"
          required
          placeholder="LuminaSkin"
          defaultValue={campaign?.brand_name ?? ''}
        />
      </div>

      <div className="fg">
        <label htmlFor="title">Campaign title *</label>
        <input
          id="title"
          name="title"
          required
          placeholder="Skincare UGC — 30sec testimonial"
          defaultValue={campaign?.title ?? ''}
        />
      </div>

      <div className="fg-row">
        <div className="fg">
          <label htmlFor="category">Category</label>
          <select id="category" name="category" defaultValue={campaign?.category ?? categories[0]}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="fg">
          <label htmlFor="content_type">Content type</label>
          <select id="content_type" name="content_type" defaultValue={campaign?.content_type ?? contentTypes[0]}>
            {contentTypes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="fg-row">
        <div className="fg">
          <label htmlFor="platform">Platform</label>
          <input
            id="platform"
            name="platform"
            placeholder="TikTok + Meta"
            defaultValue={campaign?.platform ?? ''}
          />
        </div>
        <div className="fg">
          <label htmlFor="spots_total">Spots</label>
          <input
            id="spots_total"
            name="spots_total"
            type="number"
            min={1}
            max={200}
            defaultValue={campaign?.spots_total ?? 8}
          />
        </div>
      </div>

      <div className="fg-row">
        <div className="fg">
          <label htmlFor="rate_label">Rate label</label>
          <input
            id="rate_label"
            name="rate_label"
            placeholder="$80–120/video"
            defaultValue={campaign?.rate_label ?? ''}
          />
        </div>
        <div className="fg">
          <label htmlFor="budget_usd">Budget (USD)</label>
          <input
            id="budget_usd"
            name="budget_usd"
            type="number"
            min={0}
            placeholder="5000"
            defaultValue={campaign?.budget_usd ?? ''}
          />
        </div>
      </div>

      {campaign && (
        <div className="fg">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={campaign.status}>
            {(['draft', 'active', 'paused', 'completed'] as Campaign['status'][]).map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
      )}

      <div className="fg">
        <label htmlFor="campaign_cover_file">Campaign image</label>
        <input
          id="campaign_cover_file"
          name="cover_file"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            setCoverFile(file);
            setRemoveCover(false);
            setCoverPreview((current) => {
              if (current) URL.revokeObjectURL(current);
              return file ? URL.createObjectURL(file) : null;
            });
          }}
        />
        {campaign && (
          <input
            type="hidden"
            name="cover_url"
            value={removeCover ? '' : (campaign.cover_url ?? '')}
            readOnly
          />
        )}
        <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
          JPG, PNG, WebP, GIF or AVIF, maximum 10 MB.
        </span>
      </div>

      {coverPreview && (
        <div className="campaign-cover-preview">
          <img src={coverPreview} alt="Campaign preview" />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              const hadNewFile = Boolean(coverFile);
              setCoverFile(null);
              setRemoveCover(!hadNewFile && Boolean(campaign?.cover_url));
              setCoverPreview((current) => {
                if (current && current.startsWith('blob:')) URL.revokeObjectURL(current);
                return hadNewFile ? (campaign?.cover_url ?? null) : null;
              });
              const input = document.getElementById('campaign_cover_file') as HTMLInputElement | null;
              if (input) input.value = '';
            }}
          >
            Remove image
          </button>
        </div>
      )}

      <div className="fg">
        <label htmlFor="brief_text">Brief</label>
        <textarea
          id="brief_text"
          name="brief_text"
          rows={4}
          placeholder="What creators need to know before applying."
          defaultValue={campaign?.brief_text ?? ''}
        />
      </div>

      {!campaign && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 12 }}>
          <input type="checkbox" name="publish" defaultChecked />
          Publish to the public site immediately
        </label>
      )}

      <button className="btn btn-primary" type="submit" disabled={pending} style={{ width: '100%' }}>
        {uploading ? 'Uploading image…' : pending ? 'Saving…' : (submitLabel ?? (campaign ? 'Save changes' : 'Create campaign'))}
      </button>
    </form>
  );
}
