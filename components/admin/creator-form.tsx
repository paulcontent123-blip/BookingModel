'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  PORTFOLIO_MAX_ITEMS,
  validateCreatorImageFile,
  validateCreatorInput,
} from '@/lib/creator-validation';
import { CATEGORIES, PLATFORMS, extractYouTubeId } from '@/lib/utils';
import type { ActionResult } from '@/lib/services/admin-actions';
import type { Creator, CreatorPortfolio } from '@/lib/types';

/**
 * One entry of the portfolio gallery while it is being edited. `source` is the
 * file or URL still waiting to be pushed to Cloudinary on submit; once uploaded
 * only `url` matters.
 */
interface PortfolioDraft {
  key: string;
  type: 'image' | 'video';
  url: string;
  preview: string;
  label: string;
  source: File | string | null;
}

let draftCounter = 0;
const nextKey = () => `draft-${draftCounter++}`;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Requirement #4 — admins add creators to the roster by hand.
 * Used by both /admin/creators/new and /admin/creators/[id].
 */
export function CreatorForm({
  action,
  creator,
  portfolio = [],
  submitLabel,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  creator?: Creator;
  portfolio?: CreatorPortfolio[];
  submitLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(creator?.photo_url ?? '');
  const [photoPreview, setPhotoPreview] = useState(creator?.photo_url ?? '');
  const [selectedPhotoName, setSelectedPhotoName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(creator?.avatar_url ?? '');
  const [avatarPreview, setAvatarPreview] = useState(creator?.avatar_url ?? '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const [items, setItems] = useState<PortfolioDraft[]>(() =>
    portfolio.map((p) => ({
      key: p.id,
      type: p.type,
      url: p.url,
      preview: p.thumbnail ?? p.url,
      label: p.label ?? '',
      source: null,
    })),
  );
  const [videoDraft, setVideoDraft] = useState('');
  const [imageUrlDraft, setImageUrlDraft] = useState('');
  const [galleryError, setGalleryError] = useState('');

  const rateDefault =
    creator?.rate_min != null
      ? creator.rate_max != null && creator.rate_max !== creator.rate_min
        ? `$${creator.rate_min}-${creator.rate_max}`
        : `$${creator.rate_min}`
      : '';

  const roomLeft = PORTFOLIO_MAX_ITEMS - items.length;

  function addImageFiles(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    if (selected.length > roomLeft) {
      setGalleryError(
        `Only ${PORTFOLIO_MAX_ITEMS} portfolio items are allowed — ${roomLeft} slot(s) left.`,
      );
      return;
    }
    for (const file of selected) {
      const error = validateCreatorImageFile(file);
      if (error) {
        setGalleryError(`${file.name}: ${error}`);
        return;
      }
    }
    setGalleryError('');
    setItems((current) => [
      ...current,
      ...selected.map((file) => ({
        key: nextKey(),
        type: 'image' as const,
        url: '',
        preview: URL.createObjectURL(file),
        label: 'Content sample',
        source: file,
      })),
    ]);
  }

  function addImageUrl() {
    const url = imageUrlDraft.trim();
    if (!url) return;
    if (roomLeft <= 0) {
      setGalleryError(`A creator can have at most ${PORTFOLIO_MAX_ITEMS} portfolio items.`);
      return;
    }
    if (!isHttpUrl(url)) {
      setGalleryError('Portfolio image URLs must start with http:// or https://.');
      return;
    }
    setGalleryError('');
    setImageUrlDraft('');
    setItems((current) => [
      ...current,
      { key: nextKey(), type: 'image', url: '', preview: url, label: 'Content sample', source: url },
    ]);
  }

  function addVideo() {
    const url = videoDraft.trim();
    if (!url) return;
    if (roomLeft <= 0) {
      setGalleryError(`A creator can have at most ${PORTFOLIO_MAX_ITEMS} portfolio items.`);
      return;
    }
    const youtubeId = extractYouTubeId(url);
    if (!youtubeId) {
      setGalleryError('Portfolio video must be a valid YouTube URL.');
      return;
    }
    setGalleryError('');
    setVideoDraft('');
    setItems((current) => [
      ...current,
      {
        key: nextKey(),
        type: 'video',
        url,
        preview: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
        label: 'Portfolio video',
        source: null,
      },
    ]);
  }

  function removeItem(key: string) {
    setGalleryError('');
    setItems((current) => current.filter((item) => item.key !== key));
  }

  /** Push a file or public URL through the signed admin upload endpoint. */
  async function uploadMedia(source: File | string): Promise<string> {
    const mediaForm = new FormData();
    if (source instanceof File) mediaForm.set('file', source);
    else mediaForm.set('sourceUrl', source);

    const response = await fetch('/api/admin/media/upload', { method: 'POST', body: mediaForm });
    const uploaded = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      secureUrl?: string;
      error?: string;
    };
    if (!response.ok || !uploaded.ok || !uploaded.secureUrl) {
      throw new Error(uploaded.error ?? 'The image could not be uploaded.');
    }
    return uploaded.secureUrl;
  }

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
        const enteredAvatarUrl = String(formData.get('avatar_url') ?? '').trim();
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
          avatarUrl: avatarFile ? '' : enteredAvatarUrl,
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
        const shouldUploadAvatar =
          Boolean(avatarFile) ||
          (Boolean(enteredAvatarUrl) && enteredAvatarUrl !== (creator?.avatar_url ?? ''));

        startTransition(async () => {
          try {
            if (shouldUploadPhoto || shouldUploadAvatar || items.some((item) => item.source)) {
              setUploading(true);
            }

            if (shouldUploadPhoto) {
              // Persist the Cloudinary delivery URL through the existing creator action.
              formData.set('photo_url', await uploadMedia(selectedFile ?? enteredPhotoUrl));
            }

            if (shouldUploadAvatar) {
              formData.set('avatar_url', await uploadMedia(avatarFile ?? enteredAvatarUrl));
            }

            // Upload every gallery item that is still a local file or a remote
            // URL, then post the whole gallery as one field.
            const resolved = [];
            for (const item of items) {
              const url = item.source ? await uploadMedia(item.source) : item.url;
              resolved.push({ type: item.type, url, label: item.label });
            }
            formData.set('portfolio', JSON.stringify(resolved));

            formData.delete('photo_file');
            formData.delete('avatar_file');
            formData.delete('portfolio_files');
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

      <div className="card-title" style={{ marginTop: 8 }}>Cover photo</div>

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

      <div className="card-title" style={{ marginTop: 8 }}>Avatar</div>

      <div className="fg-row">
        <div className="fg">
          <label htmlFor="avatar_file">Upload avatar from device</label>
          <input
            id="avatar_file"
            name="avatar_file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setAvatarFile(file);
              if (file) setAvatarPreview(URL.createObjectURL(file));
              else setAvatarPreview(avatarUrl);
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
            Square portrait shown next to the name on the public profile.
          </span>
        </div>
        <div className="fg">
          <label htmlFor="avatar_url">Avatar URL</label>
          <input
            id="avatar_url"
            name="avatar_url"
            placeholder="Leave empty to generate one"
            value={avatarUrl}
            onChange={(event) => {
              setAvatarUrl(event.target.value);
              if (!avatarFile) setAvatarPreview(event.target.value);
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
            Left empty, an avatar is generated from the handle — the same one the sample roster uses.
          </span>
        </div>
      </div>

      {avatarPreview && (
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
            src={avatarPreview}
            alt="Creator avatar preview"
            style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }}
          />
          <span style={{ fontSize: 12, color: 'var(--muted2)' }}>
            {avatarFile ? `Selected file: ${avatarFile.name}` : 'Current avatar preview'}
          </span>
        </div>
      )}

      <div className="card-title" style={{ marginTop: 8 }}>
        Portfolio gallery ({items.length}/{PORTFOLIO_MAX_ITEMS})
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 12 }}>
        These are the samples shown under “Portfolio” on the public profile. The sample roster carries
        about four images per creator.
      </p>

      {galleryError && (
        <div className="alert alert-error" role="alert">{galleryError}</div>
      )}

      <div className="fg-row">
        <div className="fg">
          <label htmlFor="portfolio_files">Add images from device</label>
          <input
            id="portfolio_files"
            name="portfolio_files"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            disabled={roomLeft <= 0}
            onChange={(event) => {
              addImageFiles(event.target.files);
              // Allow picking the same file again after a removal.
              event.target.value = '';
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
            Select several at once — each one is uploaded to Cloudinary on save.
          </span>
        </div>
        <div className="fg">
          <label htmlFor="portfolio_image_url">…or add an image URL</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="portfolio_image_url"
              value={imageUrlDraft}
              placeholder="https://images.unsplash.com/…"
              disabled={roomLeft <= 0}
              onChange={(event) => setImageUrlDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addImageUrl();
                }
              }}
            />
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={addImageUrl}
              disabled={roomLeft <= 0}
            >
              Add
            </button>
          </div>
        </div>
      </div>

      <div className="fg">
        <label htmlFor="portfolio_video_url">Add a portfolio video (YouTube URL)</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="portfolio_video_url"
            value={videoDraft}
            placeholder="https://youtube.com/watch?v=…"
            disabled={roomLeft <= 0}
            onChange={(event) => setVideoDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addVideo();
              }
            }}
          />
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={addVideo}
            disabled={roomLeft <= 0}
          >
            Add
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 14 }}>
          No portfolio items yet — the public profile will show “No portfolio samples uploaded yet.”
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 10,
            marginBottom: 14,
          }}
        >
          {items.map((item, index) => (
            <div
              key={item.key}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 6,
                overflow: 'hidden',
                background: 'var(--bg)',
              }}
            >
              <img
                src={item.preview}
                alt={item.label || 'Portfolio item'}
                style={{ width: '100%', height: 84, objectFit: 'cover', display: 'block' }}
              />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                  padding: '6px 8px',
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
                  {index + 1}. {item.type === 'video' ? 'Video' : 'Image'}
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={() => removeItem(item.key)}
                  aria-label={`Remove portfolio item ${index + 1}`}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card-title" style={{ marginTop: 8 }}>Notes</div>

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
          {uploading ? 'Uploading images…' : pending ? 'Saving…' : submitLabel}
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => router.push('/admin/creators')}>
          Cancel
        </button>
      </div>
    </form>
  );
}
