import { NextResponse } from 'next/server';
import { getAdminSessionUser } from '@/lib/auth';
import { CloudinaryError, uploadCreatorImage } from '@/lib/cloudinary';

export const runtime = 'nodejs';

/**
 * Admin-only media upload endpoint.
 *
 * The browser sends either `file` (multipart upload) or `sourceUrl` (a public
 * image URL). The server signs the request so CLOUDINARY_API_SECRET never
 * reaches the browser.
 */
export async function POST(request: Request) {
  const user = await getAdminSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Sign in is required.' }, { status: 401 });
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Admin access is required.' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const sourceUrl = String(formData.get('sourceUrl') ?? '').trim();

    const source = file instanceof File && file.size > 0 ? file : sourceUrl;
    if (!source) {
      return NextResponse.json(
        { ok: false, error: 'Choose an image file or enter a photo URL.' },
        { status: 400 },
      );
    }

    const uploaded = await uploadCreatorImage(source);
    return NextResponse.json({ ok: true, ...uploaded });
  } catch (error) {
    if (error instanceof CloudinaryError) {
      const status =
        error.code === 'not_configured'
          ? 503
          : error.code === 'invalid_source' || error.code === 'invalid_file'
            ? 400
            : 502;
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status });
    }

    console.error('[admin/media/upload]', error);
    return NextResponse.json(
      { ok: false, error: 'The image could not be uploaded.' },
      { status: 500 },
    );
  }
}
