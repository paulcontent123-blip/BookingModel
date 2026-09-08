import { respondToCreatorBooking } from '@/lib/services/creator-booking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

function page(title: string, message: string, tone: 'green' | 'red' | 'blue' = 'blue'): Response {
  const color = tone === 'green' ? '#00875A' : tone === 'red' ? '#C62828' : '#0057FF';
  return new Response(`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#F2F2F2;font-family:Arial,Helvetica,sans-serif;color:#0A0A0A;display:grid;place-items:center;min-height:100vh;padding:24px;box-sizing:border-box;">
  <main style="width:100%;max-width:520px;background:#fff;border:1px solid #e2e2e2;border-radius:10px;padding:34px;box-sizing:border-box;box-shadow:0 12px 40px rgba(0,0,0,.08);">
    <div style="font-size:20px;font-weight:800;margin-bottom:24px;">Booking<span style="color:#0057FF;">Model</span></div>
    <div style="width:44px;height:44px;border-radius:50%;background:${color};color:#fff;display:grid;place-items:center;font-size:24px;font-weight:700;">${tone === 'green' ? '✓' : tone === 'red' ? '!' : 'i'}</div>
    <h1 style="font-size:24px;margin:18px 0 10px;">${escapeHtml(title)}</h1>
    <p style="font-size:16px;line-height:1.6;color:#444;margin:0;">${escapeHtml(message)}</p>
    <p style="font-size:13px;line-height:1.5;color:#888;margin:24px 0 0;">You can close this page now. If you need help, reply to the BookingModel email you received.</p>
  </main>
</body></html>`, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ ref: string }> },
): Promise<Response> {
  const { ref } = await context.params;
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';
  const decision = url.searchParams.get('decision');

  if (decision !== 'accept' && decision !== 'decline') {
    return page('Invalid response link', 'This booking response link is missing a valid decision.', 'red');
  }

  try {
    const result = await respondToCreatorBooking(decodeURIComponent(ref), token, decision);
    if (result.status === 'accepted') {
      return page('Booking accepted', result.message, 'green');
    }
    if (result.status === 'declined' || result.status === 'expired') {
      return page(result.status === 'expired' ? 'Booking expired' : 'Booking declined', result.message, result.refundOk ? 'green' : 'red');
    }
    if (result.status === 'already_handled') {
      return page('Booking already handled', result.message, 'blue');
    }
    return page('Invalid response link', result.message, 'red');
  } catch (error) {
    console.error('[creator-booking-response] Failed to process response link:', error);
    return page(
      'Response could not be processed',
      'We could not reach the booking system right now. Please try this link again in a moment or contact the BookingModel team.',
      'red',
    );
  }
}
