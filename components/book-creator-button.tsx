'use client';

import { useRouter } from 'next/navigation';
import { useGeo } from './geo-provider';

/**
 * The single entry point into booking.
 *
 *   allowed region  -> /book/<creator>
 *   blocked region  -> opens the lead modal instead (requirement #2)
 *
 * The server re-checks the region on POST /api/bookings, so bypassing this
 * button does not get anyone to a payment.
 */
export function BookCreatorButton({
  creatorId,
  creatorName,
  available,
  className = 'submit-btn',
  label = 'Book this creator →',
}: {
  creatorId: string;
  creatorName: string;
  available: boolean;
  className?: string;
  label?: string;
}) {
  const { geo, openRestricted } = useGeo();
  const router = useRouter();

  if (!available) {
    return (
      <button className={className} disabled style={{ opacity: 0.55, cursor: 'not-allowed' }}>
        Not accepting bookings
      </button>
    );
  }

  if (!geo.canTransact) {
    return (
      <>
        <button
          className={className}
          onClick={() => openRestricted({ creatorId, creatorName })}
        >
          Request this creator →
        </button>
        <p className="summary-note" style={{ textAlign: 'center' }}>
          Checkout is US-only. We will set the booking up with you directly.
        </p>
      </>
    );
  }

  return (
    <button className={className} onClick={() => router.push(`/book/${creatorId}`)}>
      {label}
    </button>
  );
}
