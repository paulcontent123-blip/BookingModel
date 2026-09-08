'use client';

import { useEffect } from 'react';
import { useGeo } from './geo-provider';

/**
 * Shown on /book/[creatorId] when the visitor's region cannot check out.
 * Opens the lead modal straight away so the path is never a dead end.
 */
export function RestrictedBookingNotice({
  creatorId,
  creatorName,
}: {
  creatorId: string;
  creatorName: string;
}) {
  const { openRestricted, manager } = useGeo();

  useEffect(() => {
    openRestricted({ creatorId, creatorName });
    // Only on mount — reopening on every render would trap the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="form-box" style={{ maxWidth: 520 }}>
      <div className="form-title">Your account manager</div>
      <div className="rr-contact-row"><span>👤</span><span>{manager.name}</span></div>
      <div className="rr-contact-row">
        <span>✉️</span><a href={`mailto:${manager.email}`}>{manager.email}</a>
      </div>
      <div className="rr-contact-row">
        <span>📞</span><a href={`tel:${manager.phone.replace(/[^\d+]/g, '')}`}>{manager.phone}</a>
      </div>
      <div className="rr-contact-row">
        <span>💬</span>
        <a
          href={`https://wa.me/${manager.whatsapp.replace(/[^\d]/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp / Zalo {manager.whatsapp}
        </a>
      </div>
      <div className="rr-contact-row"><span>🕘</span><span>{manager.hours}</span></div>

      <button
        className="submit-btn"
        style={{ marginTop: 16 }}
        onClick={() => openRestricted({ creatorId, creatorName })}
      >
        Open the request form →
      </button>
    </div>
  );
}
