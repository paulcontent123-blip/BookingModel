import Link from 'next/link';
import type { Creator } from '@/lib/types';
import { compactNumber, platformClass, rateLabel } from '@/lib/utils';

export function CreatorCard({ creator }: { creator: Creator }) {
  return (
    <Link href={`/creators/${creator.id}`} className="cg-card" style={{ display: 'block' }}>
      <div
        className="cg-photo"
        style={{
          background: creator.photo_url
            ? `#EEE url(${creator.photo_url}) center top / cover`
            : (creator.accent_bg ?? '#F2F2F2'),
        }}
      >
        {!creator.photo_url && <span>{creator.emoji ?? '👤'}</span>}
        <div className="cg-badges">
          <span className={`cg-b ${platformClass(creator.platform)}`}>{creator.platform}</span>
        </div>
        {creator.status === 'active' && <span className="cg-avail">Available</span>}
      </div>

      <div className="cg-body">
        <div className="cg-name">{creator.name}</div>
        <div className="cg-handle">{creator.handle}</div>
        <span className="cg-niche-tag">{creator.niche}</span>

        <div className="cg-stats">
          <div>
            <div className="cg-stat-n">{creator.audience ?? compactNumber(creator.audience_count)}</div>
            <div className="cg-stat-l">Followers</div>
          </div>
          <div>
            <div className="cg-stat-n">{creator.er ?? '—'}</div>
            <div className="cg-stat-l">Engagement</div>
          </div>
        </div>

        <div className="cg-row">
          <div className="cg-rate">
            {rateLabel(creator)} <small>/ video</small>
          </div>
          <span className="btn-cg">View</span>
        </div>
      </div>
    </Link>
  );
}

/** Compact card used by the auto-scrolling strip under the hero. */
export function CreatorStripCard({ creator }: { creator: Creator }) {
  return (
    <Link href={`/creators/${creator.id}`} className="creator-scroll-card">
      <div
        className="csc-media"
        style={{
          background: creator.photo_url
            ? `#EEE url(${creator.photo_url}) center top / cover`
            : (creator.accent_bg ?? '#F2F2F2'),
        }}
      >
        {!creator.photo_url && <span>{creator.emoji ?? '👤'}</span>}
        <span className="csc-platform">{creator.platform}</span>
        <span className="csc-play">▶</span>
      </div>
      <div className="csc-body">
        <div className="csc-name">{creator.name}</div>
        <div className="csc-niche">{creator.audience} followers</div>
        <div className="csc-rate">{rateLabel(creator)}</div>
      </div>
    </Link>
  );
}
