import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'drive.google.com'
    || host === 'drive.usercontent.google.com'
    || host.endsWith('.googleusercontent.com');
}

/**
 * Stream public Google Drive images through this app's origin.
 *
 * Drive can reject cross-origin <img> requests even when the same URL opens in
 * a browser tab. The allow-list keeps this endpoint from becoming an open
 * server-side request proxy.
 */
export async function GET(request: Request) {
  const source = new URL(request.url).searchParams.get('url');
  if (!source) {
    return NextResponse.json({ error: 'Missing image URL.' }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(source);
  } catch {
    return NextResponse.json({ error: 'Invalid image URL.' }, { status: 400 });
  }

  if (target.protocol !== 'https:' || !isAllowedHost(target.hostname)) {
    return NextResponse.json({ error: 'Only public Google Drive image URLs are supported.' }, { status: 400 });
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 BookingModel image proxy',
      },
      redirect: 'follow',
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: 'The image could not be loaded from Google Drive.' }, { status: 502 });
    }

    const contentType = upstream.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
    if (!contentType?.startsWith('image/')) {
      return NextResponse.json({ error: 'The Drive file is not an image.' }, { status: 415 });
    }

    return new NextResponse(upstream.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[media/proxy]', error);
    return NextResponse.json({ error: 'The image proxy could not reach Google Drive.' }, { status: 502 });
  }
}
