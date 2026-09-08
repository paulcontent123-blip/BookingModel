'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  validateCreatorImageFile,
  validateCreatorInput,
} from '@/lib/creator-validation';
import { CATEGORIES, PLATFORMS } from '@/lib/utils';
import type { ActionResult } from '@/lib/services/admin-actions';
import type { Creator } from '@/lib/types';

/**
 * Requirement #4 — admins add creators to the roster by hand.
 * Used by both /admin/creators/new and /admin/creators/[id].
 */
export function CreatorForm({
  action,
  creator,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  creator?: Creator;
  submitLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(creator?.photo_url ?? '');
  const [photoPreview, setPhotoPreview] = useState(creator?.photo_url ?? '');
  const [selectedPhotoName, setSelectedPhotoName] = useState('');

  const rateDefault =
    creator?.rate_min != null
      ? creator.rate_max != null && creator.rate_max !== creator.rate_min
        ? `$${creator.rate_min}-${creator.rate_max}`
        : `$${creator.rate_min}`
      : '';

  return (
    <form
      className="card"
      style={{ maxWidth: 760 }}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        const photoEntry = formData.get('photo_file');
        const selectedFile = photoEntry instanceof File ? photoEntry : null;
        const enteredPhotoUrl = String(formData.get('photo_url') ?? '').trim();
        const validationError = validateCreatorInput({
          name: String(formData.get('name') ?? ''),
          handle: String(formData.get('handle') ?? ''),
          platform: String(formData.get('platform') ?? ''),
          channelUrl: String(formData.get('channel_url') ?? ''),
          category: String(formData.get('category') ?? ''),
          audience: String(formData.get('audience') ?? ''),
          er: String(formData.get('er') ?? ''),
          rate: String(formData.get('rate') ?? ''),
          contactEmail: String(formData.get('contact_email') ?? ''),
          // A selected file takes priority over the URL field.
          photoUrl: selectedFile ? '' : enteredPhotoUrl,
          videoUrl: String(formData.get('video_url') ?? ''),
          status: String(formData.get('status') ?? 'active'),
        });

        if (validationError) {
          setResult({ ok: false, message: validationError });
          return;
        }

        if (selectedFile) {
          const imageError = validateCreatorImageFile(selectedFile);
          if (imageError) {
            setResult({ ok: false, message: imageError });
            return;
          }
        }

        const shouldUploadPhoto =
          Boolean(selectedFile) ||
          (Boolean(enteredPhotoUrl) && enteredPhotoUrl !== (creator?.photo_url ?? ''));

        startTransition(async () => {
          try {
            if (shouldUploadPhoto) {
              setUploading(true);
              const mediaForm = new FormData();
              if (selectedFile) mediaForm.set('file', selectedFile);
              else if (enteredPhotoUrl) mediaForm.set('sourceUrl', enteredPhotoUrl);

              const uploadResponse = await fetch('/api/admin/media/upload', {
                method: 'POST',
                body: mediaForm,
              });
              const uploadResult = (await uploadResponse.json().catch(() => ({}))) as {
                ok?: boolean;
                secureUrl?: string;
                error?: string;
              };

              if (!uploadResponse.ok || !uploadResult.ok || !uploadResult.secureUrl) {
                throw new Error(uploadResult.error ?? 'The photo could not be uploaded.');
              }

              // Persist the Cloudinary delivery URL through the existing creator action.
              formData.set('photo_url', uploadResult.secureUrl);
            }

            formData.delete('photo_file');
            const res = await action(formData);
            setResult(res);
            if (res.ok) {
              if (!creator) router.push('/admin/creators?notice=created');
              else router.refresh();
            }
          } catch (error) {
            setResult({
              ok: false,
              message: error instanceof Error ? error.message : 'The photo could not be uploaded.',
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

      <div className="card-title">Profile</div>

      <div className="fg-row">
        <div className="fg">
          <label htmlFor="name">Name *</label>
          <input id="name" name="name" required defaultValue={creator?.name} />
        </div>
        <div className="fg">
          <label htmlFor="handle">Handle *</label>
          <input
            id="handle"
            name="handle"
            required
            placeholder="@myhandle"
            defaultValue={creator?.handle}
            readOnly={!!creator}
            title={creator ? 'The handle is the dedup key and cannot be changed.' : undefined}
          />
        </div>
      </div>

      <div className="fg-row">
        <div className="fg">
          <label htmlFor="platform">Platform *</label>
          <select id="platform" name="platform" required defaultValue={creator?.platform ?? 'TikTok'}>
            {[...PLATFORMS, 'Other'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="fg">
          <label htmlFor="channel_url">Channel URL</label>
          <input id="channel_url" name="channel_url" defaultValue={creator?.channel_url ?? ''} />
        </div>
      </div>

      <div className="fg-row">
        <div className="fg">
          <label htmlFor="niche">Niche</label>
          <input id="niche" name="niche" defaultValue={creator?.niche ?? ''} />
        </div>
        <div className="fg">
          <label htmlFor="category">Category</label>
          <select id="category" name="category" defaultValue={creator?.category ?? ''}>
            <option value="">—</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="fg-row">
        <div className="fg">
          <label htmlFor="audience">Audience</label>
          <input id="audience" name="audience" placeholder="82K" defaultValue={creator?.audience ?? ''} />
        </div>
        <div className="fg">
          <label htmlFor="er">Engagement rate</label>
          <input id="er" name="er" placeholder="6.2%" defaultValue={creator?.er ?? ''} />
        </div>
      </div>

      <div className="fg-row">
        <div className="fg">
          <label htmlFor="rate">Rate range</label>
          <input id="rate" name="rate" placeholder="$150-350" defaultValue={rateDefault} />
        </div>
        <div className="fg">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={creator?.status ?? 'active'}>
            {['active', 'pending', 'inactive', 'rejected'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card-title" style={{ marginTop: 20 }}>Contact</div>

      <div className="fg-row">
        <div className="fg">
          <label htmlFor="contact_email">Contact email</label>
          <input
            id="contact_email"
            name="contact_email"
            type="email"
            defaultValue={creator?.contact_email ?? ''}
          />
          <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
            Booking notifications are sent here — required before this creator can be booked.
          </span>
        </div>
        <div className="fg">
          <label htmlFor="contact_hint">Contact source / hint</label>
          <input
            id="contact_hint"
            name="contact_hint"
            placeholder="Email in TikTok bio"
            defaultValue={creator?.contact_hint ?? ''}
          />
        </div>
      </div>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 14 }}>
        <input type="checkbox" name="contact_verified" defaultChecked={creator?.contact_verified} />
        Contact verified (we have confirmed this address reaches the creator)
      </label>

      <div className="card-title" style={{ marginTop: 8 }}>Media &amp; notes</div>

      <div className="fg-row">
        <div className="fg">
          <label htmlFor="photo_file">Upload photo from device</label>
          <input
            id="photo_file"
            name="photo_file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setSelectedPhotoName(file?.name ?? '');
              if (file) setPhotoPreview(URL.createObjectURL(file));
              else if (!photoUrl) setPhotoPreview('');
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
            JPG, PNG, WebP, GIF or AVIF — maximum 10 MB. The selected file takes priority over the URL.
          </span>
        </div>
        <div className="fg">
          <label htmlFor="photo_url">Photo URL</label>
          <input
            id="photo_url"
            name="photo_url"
            placeholder="https://images.unsplash.com/…"
            value={photoUrl}
            onChange={(event) => {
              setPhotoUrl(event.target.value);
              if (!selectedPhotoName) setPhotoPreview(event.target.value);
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
            A public image URL is downloaded by Cloudinary and saved as a Cloudinary URL.
          </span>
        </div>
      </div>

      {photoPreview && (
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            padding: 10,
            marginBottom: 13,
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--bg)',
          }}
        >
          <img
            src={photoPreview}
            alt="Creator photo preview"
            style={{ width: 72, height: 72, borderRadius: 6, objectFit: 'cover', objectPosition: 'top' }}
          />
          <span style={{ fontSize: 12, color: 'var(--muted2)' }}>
            {selectedPhotoName ? `Selected file: ${selectedPhotoName}` : 'Current photo preview'}
          </span>
        </div>
      )}

      {!creator && (
        <div className="fg">
          <label htmlFor="video_url">Portfolio video (YouTube URL)</label>
          <input id="video_url" name="video_url" placeholder="https://youtube.com/watch?v=…" />
        </div>
      )}

      <div className="fg-row">
        <div className="fg">
          <label htmlFor="emoji">Fallback emoji</label>
          <input id="emoji" name="emoji" maxLength={4} defaultValue={creator?.emoji ?? '👤'} />
        </div>
      </div>

      <div className="fg">
        <label htmlFor="bio">Public bio</label>
        <textarea id="bio" name="bio" rows={3} defaultValue={creator?.bio ?? ''} />
      </div>

      <div className="fg">
        <label htmlFor="bd_notes">Internal BD notes</label>
        <textarea
          id="bd_notes"
          name="bd_notes"
          rows={3}
          placeholder="Never shown publicly."
          defaultValue={creator?.bd_notes ?? ''}
        />
      </div>

      <div className="btn-row" style={{ marginTop: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={pending || uploading}>
          {uploading ? 'Uploading photo…' : pending ? 'Saving…' : submitLabel}
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => router.push('/admin/creators')}>
          Cancel
        </button>
      </div>
    </form>
  );
}
