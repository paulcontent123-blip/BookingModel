import 'server-only';

import crypto from 'node:crypto';
import { config } from '@/lib/config';

const MAX_CREATOR_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

export type CloudinaryErrorCode =
  | 'not_configured'
  | 'invalid_source'
  | 'invalid_file'
  | 'upload_failed'
  | 'delete_failed';

export class CloudinaryError extends Error {
  constructor(
    message: string,
    public readonly code: CloudinaryErrorCode,
  ) {
    super(message);
    this.name = 'CloudinaryError';
  }
}

export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  format: string | null;
  skipped: boolean;
}

interface CloudinaryResponse {
  secure_url?: string;
  public_id?: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
  error?: { message?: string };
}

interface CloudinaryDestroyResponse {
  result?: string;
  error?: { message?: string };
}

/**
 * A Cloudinary delivery URL is already hosted by the target media service.
 * Keeping it avoids re-uploading the same image when an admin edits a creator
 * without changing the existing photo.
 */
export function isCloudinaryDeliveryUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'res.cloudinary.com' || url.hostname.endsWith('.cloudinary.com')) &&
      /\/image\/upload\//.test(url.pathname)
    );
  } catch {
    return false;
  }
}

/**
 * Extracts the original public_id from the secure URL returned by our upload.
 * Upload responses use the form:
 *   /image/upload/v123456/bookingmodel/creators/file-name.jpg
 */
export function cloudinaryPublicIdFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'res.cloudinary.com' ||
      !isCloudinaryDeliveryUrl(value)
    ) {
      return null;
    }

    const pathMarker = '/image/upload/';
    const markerIndex = url.pathname.indexOf(pathMarker);
    if (markerIndex === -1) return null;

    const cloudName = url.pathname.slice(1, markerIndex).split('/')[0];
    if (!cloudName || (config.cloudinary.cloudName && cloudName !== config.cloudinary.cloudName)) {
      return null;
    }

    const segments = url.pathname
      .slice(markerIndex + pathMarker.length)
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));

    // Tolerate derived URLs with transformations before the version.
    while (
      segments.length > 1 &&
      /^(?:c_|w_|h_|ar_|g_|f_|q_|fl_|dpr_|e_|r_|x_|y_|z_|so_|du_)/.test(segments[0]!)
    ) {
      segments.shift();
    }

    if (segments[0] && /^v\d+$/.test(segments[0])) segments.shift();

    if (!segments.length) return null;
    const publicId = segments.join('/');
    const extensionIndex = publicId.lastIndexOf('.');
    return extensionIndex > publicId.lastIndexOf('/')
      ? publicId.slice(0, extensionIndex)
      : publicId;
  } catch {
    return null;
  }
}

function assertRemoteUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CloudinaryError('Photo URL must be a valid URL.', 'invalid_source');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new CloudinaryError('Photo URL must start with http:// or https://.', 'invalid_source');
  }

  if (url.username || url.password) {
    throw new CloudinaryError('Photo URL must not contain embedded credentials.', 'invalid_source');
  }

  const hostname = url.hostname.toLowerCase();
  const blockedHost =
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

  if (blockedHost) {
    throw new CloudinaryError('Photo URL must point to a public image URL.', 'invalid_source');
  }
}

function signUploadParams(params: Record<string, string>): string {
  const serialized = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return crypto
    .createHash('sha1')
    .update(`${serialized}${config.cloudinary.apiSecret}`)
    .digest('hex');
}

function ensureCloudinaryConfigured(): void {
  if (!config.cloudinary.enabled) {
    throw new CloudinaryError(
      'Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to .env.local.',
      'not_configured',
    );
  }
}

/**
 * Uploads either a browser File or a public remote URL through Cloudinary's
 * signed upload endpoint. The API secret is used only on the server.
 */
export async function uploadCreatorImage(source: File | string): Promise<CloudinaryUploadResult> {
  if (typeof source === 'string') {
    const value = source.trim();
    if (!value) {
      throw new CloudinaryError('Photo URL cannot be empty.', 'invalid_source');
    }

    if (isCloudinaryDeliveryUrl(value)) {
      return {
        secureUrl: value,
        publicId: null,
        width: null,
        height: null,
        bytes: null,
        format: null,
        skipped: true,
      };
    }

    assertRemoteUrl(value);
  } else {
    if (!source || source.size === 0) {
      throw new CloudinaryError('The selected image is empty.', 'invalid_file');
    }
    if (source.size > MAX_CREATOR_IMAGE_BYTES) {
      throw new CloudinaryError('The selected image must be 10 MB or smaller.', 'invalid_file');
    }
    if (!ALLOWED_IMAGE_TYPES.has(source.type.toLowerCase())) {
      throw new CloudinaryError(
        'Only JPG, PNG, WebP, GIF and AVIF images are supported.',
        'invalid_file',
      );
    }
  }

  ensureCloudinaryConfigured();

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = config.cloudinary.folder || 'bookingmodel/creators';
  const signedParams = { folder, timestamp };
  const body = new FormData();
  body.append('file', typeof source === 'string' ? source : source);
  body.append('api_key', config.cloudinary.apiKey);
  body.append('timestamp', timestamp);
  body.append('folder', folder);
  body.append('signature', signUploadParams(signedParams));

  let response: Response;
  try {
    response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudinary.cloudName)}/image/upload`,
      { method: 'POST', body },
    );
  } catch {
    throw new CloudinaryError(
      'Could not reach Cloudinary. Check the network and Cloudinary configuration.',
      'upload_failed',
    );
  }

  let result: CloudinaryResponse = {};
  try {
    result = (await response.json()) as CloudinaryResponse;
  } catch {
    // Keep the generic upload error below when Cloudinary returns a non-JSON response.
  }

  if (!response.ok || !result.secure_url) {
    const message = result.error?.message || `Cloudinary upload failed (${response.status}).`;
    throw new CloudinaryError(message, 'upload_failed');
  }

  return {
    secureUrl: result.secure_url,
    publicId: result.public_id ?? null,
    width: result.width ?? null,
    height: result.height ?? null,
    bytes: result.bytes ?? null,
    format: result.format ?? null,
    skipped: false,
  };
}

/**
 * Deletes an image uploaded by this project and invalidates its CDN cache.
 * Non-Cloudinary URLs and Cloudinary URLs belonging to another cloud are
 * treated as external assets and left untouched.
 */
export async function deleteCloudinaryImage(sourceUrl: string | null): Promise<boolean> {
  if (!sourceUrl || !isCloudinaryDeliveryUrl(sourceUrl)) return false;

  // Do not delete the database row while silently leaving a project-owned
  // Cloudinary image behind just because the server was restarted without key.
  if (!config.cloudinary.enabled) ensureCloudinaryConfigured();

  const publicId = cloudinaryPublicIdFromUrl(sourceUrl);
  if (!publicId) return false;

  ensureCloudinaryConfigured();

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signedParams = { invalidate: 'true', public_id: publicId, timestamp };
  const body = new FormData();
  body.append('public_id', publicId);
  body.append('timestamp', timestamp);
  body.append('invalidate', 'true');
  body.append('api_key', config.cloudinary.apiKey);
  body.append('signature', signUploadParams(signedParams));

  let response: Response;
  try {
    response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudinary.cloudName)}/image/destroy`,
      { method: 'POST', body },
    );
  } catch {
    throw new CloudinaryError(
      'Could not reach Cloudinary while deleting the creator image.',
      'delete_failed',
    );
  }

  let result: CloudinaryDestroyResponse = {};
  try {
    result = (await response.json()) as CloudinaryDestroyResponse;
  } catch {
    // Keep the generic delete error below when Cloudinary returns a non-JSON response.
  }

  // "not found" is safe to treat as success because the asset is already gone.
  if (!response.ok || !['ok', 'not found'].includes(result.result ?? '')) {
    const message = result.error?.message || `Cloudinary delete failed (${response.status}).`;
    throw new CloudinaryError(message, 'delete_failed');
  }

  return result.result === 'ok';
}
