'use client';

import { useState } from 'react';

const ACCEPTED = 'image/jpeg,image/png,image/webp,image/gif,image/avif';
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Cover image field shared by the news and showcase editors.
 *
 * The file (or a public URL) is pushed through /api/admin/media/upload on
 * submit, which signs the request server-side, so the Cloudinary secret never
 * reaches the browser. The parent form calls `uploadCover` before saving.
 */
export function validateCoverFile(file: File): string | null {
  if (file.size === 0) return 'The selected image is empty.';
  if (file.size > MAX_BYTES) return 'The cover image must be 10 MB or smaller.';
  if (!ACCEPTED.split(',').includes(file.type.toLowerCase())) {
    return 'Only JPG, PNG, WebP, GIF and AVIF images are supported.';
  }
  return null;
}

/** Pushes a file or a public URL through the signed admin upload endpoint. */
export async function uploadCover(source: File | string): Promise<string> {
  const body = new FormData();
  if (source instanceof File) body.set('file', source);
  else body.set('sourceUrl', source);

  const response = await fetch('/api/admin/media/upload', { method: 'POST', body });
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

export function CoverPicker({
  currentUrl,
  onFileChange,
  hint,
}: {
  currentUrl: string | null;
  onFileChange: (file: File | null) => void;
  hint: string;
}) {
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [fileName, setFileName] = useState<string | null>(null);
  const [urlValue, setUrlValue] = useState(currentUrl ?? '');

  return (
    <>
      <div className="fg-row">
        <div className="fg">
          <label htmlFor="cover_file">Upload cover from device</label>
          <input
            id="cover_file"
            name="cover_file"
            type="file"
            accept={ACCEPTED}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              onFileChange(file);
              setFileName(file?.name ?? null);
              setPreview(file ? URL.createObjectURL(file) : urlValue || currentUrl);
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--muted2)' }}>{hint}</span>
        </div>
        <div className="fg">
          <label htmlFor="cover_url">…or paste an image URL</label>
          <input
            id="cover_url"
            name="cover_url"
            value={urlValue}
            placeholder="https://…"
            onChange={(event) => {
              setUrlValue(event.target.value);
              if (!fileName) setPreview(event.target.value || null);
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
            A public image URL is downloaded by Cloudinary and stored as a Cloudinary URL. Leave
            both empty to fall back to the emoji tile.
          </span>
        </div>
      </div>

      {preview && (
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
            src={preview}
            alt="Cover preview"
            style={{ width: 132, height: 74, borderRadius: 6, objectFit: 'cover' }}
          />
          <span style={{ fontSize: 12, color: 'var(--muted2)' }}>
            {fileName ? `Selected file: ${fileName}` : 'Current cover preview'}
          </span>
        </div>
      )}
    </>
  );
}
