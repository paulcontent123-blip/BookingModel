import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { resolveGeo } from '@/lib/guard';
import { config } from '@/lib/config';
import { planFeePercent } from '@/lib/plans';
import { countryName, restrictionMessage } from '@/lib/geo';
import { rateLabel, unitPriceFor } from '@/lib/utils';
import { CheckoutForm } from '@/components/checkout-form';
import { RestrictedBookingNotice } from '@/components/restricted-booking-notice';

export const metadata: Metadata = { title: 'Book a creator' };

export default async function BookPage({ params }: { params: Promise<{ creatorId: string }> }) {
  const { creatorId } = await params;
  const creator = await db.get('creators', creatorId);
  if (!creator) notFound();

  const [user, geo] = await Promise.all([getSessionUser(), resolveGeo()]);

  // Requirement #1 — the page itself refuses to render a checkout outside the
  // allowed region. The API enforces the same rule independently.
  if (!geo.canTransact) {
    return (
      <section className="sec" style={{ maxWidth: 720 }}>
        <Link href={`/creators/${creator.id}`} className="sol-back">← Back to profile</Link>
        <h1 className="sec-h">Booking assistance for <strong>{countryName(geo.country)}</strong></h1>
        <p className="sec-p">{restrictionMessage(geo)}</p>
        <RestrictedBookingNotice
          creatorId={creator.id}
          creatorName={`${creator.name} (${creator.handle})`}
        />
      </section>
    );
  }

  if (creator.status !== 'active') {
    return (
      <section className="sec" style={{ maxWidth: 640 }}>
        <div className="alert alert-warn">
          <strong>{creator.name}</strong> is not accepting bookings at the moment.
        </div>
        <Link href="/marketplace" className="btn-ghost">Browse other creators</Link>
      </section>
    );
  }

  return (
    <section className="sec">
      <Link href={`/creators/${creator.id}`} className="sol-back">← Back to profile</Link>
      <div className="sec-eye">Checkout</div>
      <h1 className="sec-h">Book <strong>{creator.name}</strong></h1>
      <p className="sec-p">
        {creator.handle} · {creator.platform} · {creator.audience} followers · {rateLabel(creator)} per video
      </p>

      <CheckoutForm
        creator={{
          id: creator.id,
          name: creator.name,
          handle: creator.handle,
          platform: creator.platform,
          photo_url: creator.photo_url,
          accent_bg: creator.accent_bg,
          emoji: creator.emoji,
          unitPrice: unitPriceFor(creator),
          rateLabel: rateLabel(creator),
        }}
        defaults={{
          brandName: user?.company_name ?? user?.full_name ?? '',
          brandEmail: user?.email ?? '',
        }}
        payment={{
          // Fee tier comes from the signed-in plan, never from the browser.
          feePercent: planFeePercent(user?.plan),
          taxPercent: config.payments.taxPercent,
        }}
        country={geo.country}
      />
    </section>
  );
}
