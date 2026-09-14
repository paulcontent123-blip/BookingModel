import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { CloudinaryError, uploadCreatorImage } from '@/lib/cloudinary';

export const runtime = 'nodejs';

/** Brand/agency avatar upload endpoint. The Cloudinary secret stays server-side. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Sign in is required.' }, { status: 401 });
  }
  if (user.role !== 'brand' && user.role !== 'agency') {
    return NextResponse.json({ ok: false, error: 'Brand account access is required.' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const sourceUrl = String(formData.get('sourceUrl') ?? '').trim();
    const source = file instanceof File && file.size > 0 ? file : sourceUrl;

    if (!source) {
      return NextResponse.json(
        { ok: false, error: 'Choose an image file or enter an image URL.' },
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

    console.error('[media/upload]', error);
    return NextResponse.json(
      { ok: false, error: 'The image could not be uploaded.' },
      { status: 500 },
    );
  }
}
