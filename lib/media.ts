import type { Creator } from '@/lib/types';

function isGoogleDriveHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'drive.google.com'
    || host === 'drive.usercontent.google.com'
    || host.endsWith('.googleusercontent.com');
}

/**
 * Return a browser-safe creator image URL.
 *
 * Google Drive share/download responses can be opened as a top-level page but
 * may reject a cross-origin image embed. Route those URLs through our own
 * image proxy; normal CDN URLs remain untouched.
 */
function browserImageUrl(source: string): string {
  try {
    const url = new URL(source);
    if (url.protocol === 'https:' && isGoogleDriveHost(url.hostname)) {
      return `/api/media/proxy?url=${encodeURIComponent(url.toString())}`;
    }
  } catch {
    // Keep the original value for the browser to handle, if it is relative.
  }

  return source;
}

/**
 * Return every usable image source stored on the creator record, in display
 * order. Keeping both values lets the client recover when photo_url is stale
 * but avatar_url is still valid (or vice versa).
 */
export function creatorImageSources(
  creator: Pick<Creator, 'photo_url' | 'avatar_url'>,
): string[] {
  const sources = [creator.photo_url, creator.avatar_url]
    .map((source) => (typeof source === 'string' ? source.trim() : ''))
    .filter(Boolean)
    .map(browserImageUrl);

  return Array.from(new Set(sources));
}

export function creatorImageUrl(creator: Pick<Creator, 'photo_url' | 'avatar_url'>): string | null {
  return creatorImageSources(creator)[0] ?? null;
}
