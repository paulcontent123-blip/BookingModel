import { config } from '@/lib/config';
import { expirePendingCreatorBookings } from '@/lib/services/creator-booking';

export const runtime = 'nodejs';

function authorized(request: Request): boolean {
  const secret = config.cron.secret;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

async function run(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const result = await expirePendingCreatorBookings();
  return Response.json({ ok: true, ...result });
}

export async function GET(request: Request): Promise<Response> {
  return run(request);
}

export async function POST(request: Request): Promise<Response> {
  return run(request);
}
