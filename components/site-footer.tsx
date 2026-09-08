import Link from 'next/link';
import { config } from '@/lib/config';

export function SiteFooter() {
  return (
    <footer>
      <div className="ft-inner">
        <div className="ft-grid">
          <div>
            <div className="ft-logo">
              Booking<em>Model</em>
            </div>
            <p className="ft-about">
              Creator marketing platform for North American brands. UGC, influencer campaigns,
              e-commerce operations and production — end to end.
            </p>
          </div>

          <div className="ft-col">
            <h4>Solutions</h4>
            <Link href="/solutions/ugc">On-Demand UGC</Link>
            <Link href="/solutions/influencer">Influencer Marketing</Link>
            <Link href="/solutions/ecommerce">E-Commerce Service</Link>
            <Link href="/solutions/advertising">Advertising</Link>
            <Link href="/solutions/production">Production &amp; Livestream</Link>
            <Link href="/solutions/brand">Brand Identity &amp; SEO</Link>
          </div>

          <div className="ft-col">
            <h4>Platform</h4>
            <Link href="/marketplace">Creator Marketplace</Link>
            <Link href="/campaigns">Open Campaigns</Link>
            <Link href="/apply">Apply as Creator</Link>
            <Link href="/login">Brand Login</Link>
            <Link href="/signup">Create Account</Link>
          </div>

          <div className="ft-col">
            <h4>Company</h4>
            <Link href="/news">News &amp; Showcase</Link>
            <Link href="/partnership">Partnership</Link>
            <Link href="/contact">Contact</Link>
          </div>

          <div className="ft-col">
            <h4>Contact</h4>
            <a href={`mailto:${config.manager.email}`}>{config.manager.email}</a>
            <a href={`tel:${config.manager.phone.replace(/[^\d+]/g, '')}`}>{config.manager.phone}</a>
            <span style={{ display: 'block', fontSize: 12.5, marginBottom: 7 }}>
              {config.manager.hours}
            </span>
          </div>
        </div>

        <div className="ft-bot">
          <span>© {new Date().getFullYear()} BookingModel.com — VEA Group · VEA Tech</span>
          <span>
            Self-serve checkout available in {config.geo.allowedCountries.join(' · ')} ·
            Other regions handled by an account manager
          </span>
        </div>
      </div>
    </footer>
  );
}
