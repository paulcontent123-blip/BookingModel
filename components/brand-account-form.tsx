'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Brand } from '@/lib/types';
import {
  BRAND_COMPANY_SIZES,
  BRAND_COUNTRIES,
  BRAND_INDUSTRIES,
  brandInitials,
} from '@/lib/brand-profile';
import { updateBrandProfileAction } from '@/lib/services/brand-actions';

type BrandActionResult = { ok: boolean; message: string };
type SaveAction = (formData: FormData) => Promise<BrandActionResult>;

const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/gif,image/avif';
const ACCEPTED_IMAGE_SET = new Set(ACCEPTED_IMAGE_TYPES.split(','));
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function imageError(file: File): string | null {
  if (file.size === 0) return 'The selected image is empty.';
  if (file.size > MAX_IMAGE_BYTES) return 'The avatar must be 10 MB or smaller.';
  if (!ACCEPTED_IMAGE_SET.has(file.type.toLowerCase())) {
    return 'Only JPG, PNG, WebP, GIF and AVIF images are supported.';
  }
  return null;
}

async function uploadAvatar(file: File, endpoint: string): Promise<string> {
  const body = new FormData();
  body.set('file', file);
  const response = await fetch(endpoint, { method: 'POST', body });
  const uploaded = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    secureUrl?: string;
    error?: string;
  };
  if (!response.ok || !uploaded.ok || !uploaded.secureUrl) {
    throw new Error(uploaded.error ?? 'The avatar could not be uploaded.');
  }
  return uploaded.secureUrl;
}

export function BrandAccountForm({
  brand,
  accountEmail,
  action,
  submitLabel = 'Save changes',
  adminMode = false,
}: {
  brand: Brand;
  accountEmail: string;
  action?: SaveAction;
  submitLabel?: string;
  adminMode?: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(brand.avatar_url);
  const [previewUrl, setPreviewUrl] = useState<string | null>(brand.avatar_url);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<BrandActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const save = action ?? updateBrandProfileAction;
  const initial = brandInitials(brand.brand_name);

  function chooseFile(file: File | null) {
    if (!file) return;
    const error = imageError(file);
    if (error) {
      setResult({ ok: false, message: error });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setResult(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function removeAvatar() {
    setAvatarUrl(null);
    setPreviewUrl(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const endpoint = adminMode ? '/api/admin/media/upload' : '/api/media/upload';

    startTransition(() => {
      void (async () => {
        try {
          let nextAvatarUrl = avatarUrl;
          if (selectedFile) nextAvatarUrl = await uploadAvatar(selectedFile, endpoint);
          formData.set('avatar_url', nextAvatarUrl ?? '');

          const nextResult = await save(formData);
          setResult(nextResult);
          if (!nextResult.ok) return;

          setAvatarUrl(nextAvatarUrl);
          setSelectedFile(null);
          if (adminMode) {
            router.push('/admin/brands');
          } else {
            router.refresh();
          }
        } catch (error) {
          setResult({
            ok: false,
            message: error instanceof Error ? error.message : 'The brand account could not be saved.',
          });
        }
      })();
    });
  }

  return (
    <form className="brand-account-form" onSubmit={submit}>
      <section className="brand-account-card">
        <div className="brand-account-section-heading">
          <div>
            <h2>Brand identity</h2>
            <p>Public-facing information used across your BookingModel account.</p>
          </div>
        </div>

        <div className="brand-account-avatar-row">
          <div className="brand-account-avatar">
            {previewUrl ? <img src={previewUrl} alt={`${brand.brand_name} avatar`} /> : initial}
          </div>
          <div className="brand-account-avatar-controls">
            <strong>Brand avatar / logo</strong>
            <span>JPG, PNG, WebP, GIF or AVIF · maximum 10 MB.</span>
            <div className="brand-account-avatar-buttons">
              <label className="brand-account-file-button">
                Choose image
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES}
                  onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
                />
              </label>
              {(previewUrl || avatarUrl) && (
                <button type="button" className="brand-account-remove-button" onClick={removeAvatar}>
                  Remove avatar
                </button>
              )}
            </div>
            {selectedFile && <small>Selected: {selectedFile.name}</small>}
          </div>
        </div>

        <div className="brand-account-field-grid">
          <label className="brand-account-field brand-account-field-wide">
            <span>Brand name *</span>
            <input name="brand_name" required maxLength={120} defaultValue={brand.brand_name} />
          </label>
          <label className="brand-account-field">
            <span>Legal company name</span>
            <input name="legal_name" maxLength={180} defaultValue={brand.legal_name ?? ''} />
          </label>
          <label className="brand-account-field">
            <span>Website</span>
            <input name="website" type="url" placeholder="https://yourbrand.com" defaultValue={brand.website ?? ''} />
          </label>
          <label className="brand-account-field">
            <span>Industry</span>
            <select name="industry" defaultValue={brand.industry ?? ''}>
              <option value="">Select an industry</option>
              {BRAND_INDUSTRIES.map((industry) => <option key={industry} value={industry}>{industry}</option>)}
            </select>
          </label>
          <label className="brand-account-field">
            <span>Company size</span>
            <select name="company_size" defaultValue={brand.company_size ?? ''}>
              <option value="">Select company size</option>
              {BRAND_COMPANY_SIZES.map((size) => <option key={size} value={size}>{size} employees</option>)}
            </select>
          </label>
          <label className="brand-account-field">
            <span>Country</span>
            <select name="country" defaultValue={brand.country || 'US'}>
              {BRAND_COUNTRIES.map((country) => <option key={country.value} value={country.value}>{country.label}</option>)}
            </select>
          </label>
          <label className="brand-account-field">
            <span>State / region</span>
            <input name="state" placeholder="California or CA" defaultValue={brand.state ?? ''} />
          </label>
          <label className="brand-account-field">
            <span>City</span>
            <input name="city" placeholder="Los Angeles" defaultValue={brand.city ?? ''} />
          </label>
          <label className="brand-account-field brand-account-field-wide">
            <span>Timezone</span>
            <input name="timezone" placeholder="America/New_York" defaultValue={brand.timezone ?? ''} />
          </label>
          <label className="brand-account-field brand-account-field-wide">
            <span>Brand description</span>
            <textarea
              name="description"
              rows={5}
              maxLength={2000}
              placeholder="Tell creators and the VEA team what your brand does."
              defaultValue={brand.description ?? ''}
            />
          </label>
        </div>
      </section>

      <section className="brand-account-card">
        <div className="brand-account-section-heading">
          <div>
            <h2>Contact information</h2>
            <p>Used by the BookingModel team when coordinating campaigns.</p>
          </div>
        </div>
        <div className="brand-account-field-grid">
          <label className="brand-account-field">
            <span>Contact name</span>
            <input name="contact_name" maxLength={120} defaultValue={brand.contact_name ?? ''} />
          </label>
          <label className="brand-account-field">
            <span>Contact email</span>
            <input name="contact_email" type="email" maxLength={180} defaultValue={brand.contact_email ?? accountEmail} />
          </label>
          <label className="brand-account-field">
            <span>Phone</span>
            <input name="contact_phone" type="tel" maxLength={40} defaultValue={brand.contact_phone ?? ''} />
          </label>
          <label className="brand-account-field">
            <span>Login email</span>
            <input value={accountEmail} readOnly aria-readonly="true" />
          </label>
        </div>
      </section>

      <section className="brand-account-card">
        <div className="brand-account-section-heading">
          <div>
            <h2>Social profiles</h2>
            <p>Optional links that help the team understand your brand and campaign channels.</p>
          </div>
        </div>
        <div className="brand-account-field-grid">
          <label className="brand-account-field">
            <span>LinkedIn</span>
            <input name="linkedin_url" type="url" placeholder="https://linkedin.com/company/…" defaultValue={brand.linkedin_url ?? ''} />
          </label>
          <label className="brand-account-field">
            <span>Instagram</span>
            <input name="instagram_url" type="url" placeholder="https://instagram.com/…" defaultValue={brand.instagram_url ?? ''} />
          </label>
          <label className="brand-account-field">
            <span>TikTok</span>
            <input name="tiktok_url" type="url" placeholder="https://tiktok.com/@…" defaultValue={brand.tiktok_url ?? ''} />
          </label>
        </div>
      </section>

      {adminMode && (
        <section className="brand-account-card">
          <div className="brand-account-field-grid">
            <label className="brand-account-field">
              <span>Profile status</span>
              <select name="status" defaultValue={brand.status}>
                <option value="active">Active</option>
                <option value="pending">Pending review</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>
        </section>
      )}

      <input type="hidden" name="avatar_url" value={avatarUrl ?? ''} readOnly />
      <div className="brand-account-form-footer">
        <button type="submit" className="brand-account-submit" disabled={pending}>
          {pending ? 'Saving…' : submitLabel}
        </button>
        {result && (
          <p className={`brand-account-result ${result.ok ? 'success' : 'error'}`} role="status" aria-live="polite">
            {result.message}
          </p>
        )}
      </div>
    </form>
  );
}
