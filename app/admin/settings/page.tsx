import { config, integrationStatus } from '@/lib/config';
import { db, usingLocalStore } from '@/lib/db';
import { countryName } from '@/lib/geo';
import { paymentProvider } from '@/lib/payments';
import { PLAN_FEATURE_LABELS, PLAN_ORDER, PLANS, revealLimitLabel } from '@/lib/plans';
import { SeedButton } from '@/components/admin/seed-button';
import { ActionButton } from '@/components/admin/action-button';
import { setGeoStatusPanelVisibilityAction } from '@/lib/services/admin-actions';
import { isGeoStatusPanelVisible } from '@/lib/platform-settings';

export const metadata = { title: 'Settings & Keys' };

export default async function SettingsPage() {
  const [settings, creatorCount, geoStatusPanelVisible] = await Promise.all([
    db.list('settings', { orderBy: 'key' }),
    db.count('creators'),
    isGeoStatusPanelVisible(),
  ]);
  const integrations = integrationStatus();
  const provider = paymentProvider();

  return (
    <>
      <h1 className="pg-title">Settings &amp; API Keys</h1>
      <p className="pg-sub">
        Every integration below is read from environment variables. Fill the real values into{' '}
        <code>.env.local</code> (or your Vercel project settings) and restart — no code change
        needed. See <code>docs/SUPABASE_SETUP.md</code> and <code>docs/API_KEYS.md</code>.
      </p>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Integration status</div>
        <table>
          <thead>
            <tr><th>Service</th><th>Currently using</th><th>Env variable</th><th>Live</th></tr>
          </thead>
          <tbody>
            {integrations.map((i) => (
              <tr key={i.key}>
                <td style={{ fontWeight: 700 }}>{i.key}</td>
                <td>{i.value}</td>
                <td><code style={{ fontSize: 11.5 }}>{i.hint}</code></td>
                <td>
                  {i.ok ? (
                    <span className="badge badge-green">configured</span>
                  ) : (
                    <span className="badge badge-amber">placeholder</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Regional payment gate</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.8, marginBottom: 12 }}>
          Visitors from any country can browse the marketplace and see rates. Only visitors from the
          allowed list can create a booking and pay — everyone else is routed to the &ldquo;leave
          your details&rdquo; form, which lands in <strong>Regional Requests</strong>. The rule is
          enforced server-side on <code>POST /api/bookings</code>, so it cannot be bypassed from the
          browser.
        </p>
        <table>
          <tbody>
            <tr>
              <td style={{ width: 260, fontWeight: 700 }}>Checkout allowed in</td>
              <td>
                {config.geo.allowedCountries.map((c) => (
                  <span className="badge badge-green" key={c} style={{ marginRight: 5 }}>
                    {c} — {countryName(c)}
                  </span>
                ))}
                <div style={{ fontSize: 11.5, color: 'var(--muted2)', marginTop: 5 }}>
                  <code>PAYMENT_ALLOWED_COUNTRIES</code>
                </div>
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700 }}>Restricted-region copy for</td>
              <td>
                {config.geo.restrictedCountries.map((c) => (
                  <span className="badge badge-amber" key={c} style={{ marginRight: 4 }}>{c}</span>
                ))}
                <div style={{ fontSize: 11.5, color: 'var(--muted2)', marginTop: 5 }}>
                  <code>RESTRICTED_REGION_COUNTRIES</code>
                </div>
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700 }}>When country is unknown</td>
              <td>
                <span className={`badge ${config.geo.unknownPolicy === 'allow' ? 'badge-amber' : 'badge-blue'}`}>
                  {config.geo.unknownPolicy === 'allow' ? 'treat as allowed' : 'treat as blocked'}
                </span>
                <div style={{ fontSize: 11.5, color: 'var(--muted2)', marginTop: 5 }}>
                  <code>GEO_UNKNOWN_POLICY</code> — set to <code>block</code> before going live so a
                  proxy cannot slip through.
                </div>
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700 }}>Geo providers</td>
              <td>
                {config.geo.providers.join(' → ')}
                <div style={{ fontSize: 11.5, color: 'var(--muted2)', marginTop: 5 }}>
                  Vercel and Cloudflare headers need no key. <code>ipinfo</code> is the fallback for
                  other hosts.
                </div>
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700 }}>GEO test switcher</td>
              <td>
                {geoStatusPanelVisible ? (
                  <span className="badge badge-green">ENABLED</span>
                ) : (
                  <span className="badge badge-blue">DISABLED</span>
                )}
                <span style={{ marginLeft: 8 }}>
                  <ActionButton
                    action={setGeoStatusPanelVisibilityAction.bind(null, !geoStatusPanelVisible)}
                    label={geoStatusPanelVisible ? 'Disable GEO test' : 'Enable GEO test'}
                    pendingLabel="Saving…"
                    className="btn btn-ghost btn-xs"
                  />
                </span>
                <div style={{ fontSize: 11.5, color: 'var(--muted2)', marginTop: 5 }}>
                  Enabled: the public GEO dropdown can simulate countries for deployment testing.
                  Disabled: the dropdown is hidden and all test overrides are ignored; the site uses
                  automatic IP detection.
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Payments &amp; fees</div>
        <table>
          <tbody>
            <tr>
              <td style={{ width: 260, fontWeight: 700 }}>Active provider</td>
              <td>
                <span className={`badge ${provider.isLive ? 'badge-green' : 'badge-amber'}`}>
                  {provider.name} {provider.isLive ? '(live)' : '(test — no real charges)'}
                </span>
                <div style={{ fontSize: 11.5, color: 'var(--muted2)', marginTop: 5 }}>
                  <code>PAYMENT_PROVIDER</code> — switch to <code>stripe</code> and set{' '}
                  <code>STRIPE_SECRET_KEY</code> when you pick a processor. The booking, invoice and
                  email flow does not change.
                </div>
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700 }}>Platform fee</td>
              <td>
                Charged per plan tier — see the plan matrix below.{' '}
                <code style={{ fontSize: 11.5 }}>lib/plans.ts</code>
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700 }}>Tax</td>
              <td>{config.payments.taxPercent}% <code style={{ fontSize: 11.5 }}>TAX_PERCENT</code></td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700 }}>Reference prefix</td>
              <td>
                {config.payments.invoicePrefix}-2026-0001 (deals) ·{' '}
                {config.payments.invoicePrefix}-INV-2026-0001 (invoices)
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Brand plans — access control &amp; fees</div>
        <p style={{ fontSize: 12.5, color: 'var(--muted2)', margin: '0 0 12px' }}>
          Single source of truth: <code>lib/plans.ts</code>. Every gate in the app (contact reveals,
          brief builder, shortlists, analytics, booking fee) reads this matrix, so changing a value
          here changes the product everywhere. Admin accounts bypass all plan gates.
        </p>
        <table>
          <thead>
            <tr>
              <th>Entitlement</th>
              {PLAN_ORDER.map((key) => (
                <th key={key} style={{ textAlign: 'center' }}>{PLANS[key].name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: 700 }}>Price</td>
              {PLAN_ORDER.map((key) => (
                <td key={key} style={{ textAlign: 'center' }}>
                  {PLANS[key].priceUsd === null ? 'Contact sales' : `${PLANS[key].priceLabel}/mo`}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ fontWeight: 700 }}>Platform fee on bookings</td>
              {PLAN_ORDER.map((key) => (
                <td key={key} style={{ textAlign: 'center' }}>{PLANS[key].feePercent}%</td>
              ))}
            </tr>
            <tr>
              <td style={{ fontWeight: 700 }}>Contact reveals per day</td>
              {PLAN_ORDER.map((key) => (
                <td key={key} style={{ textAlign: 'center' }}>{revealLimitLabel(key)}</td>
              ))}
            </tr>
            {(Object.keys(PLAN_FEATURE_LABELS) as (keyof typeof PLAN_FEATURE_LABELS)[]).map((feature) => (
              <tr key={feature}>
                <td>{PLAN_FEATURE_LABELS[feature]}</td>
                {PLAN_ORDER.map((key) => (
                  <td key={key} style={{ textAlign: 'center' }}>
                    {PLANS[key].features[feature] ? '✓' : '✕'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Public contact details (shown to restricted regions)</div>
        <table>
          <tbody>
            <tr><td style={{ width: 260, fontWeight: 700 }}>Manager</td><td>{config.manager.name}</td></tr>
            <tr><td style={{ fontWeight: 700 }}>Email</td><td>{config.manager.email}</td></tr>
            <tr><td style={{ fontWeight: 700 }}>Phone</td><td>{config.manager.phone}</td></tr>
            <tr><td style={{ fontWeight: 700 }}>WhatsApp / Zalo</td><td>{config.manager.whatsapp}</td></tr>
            <tr><td style={{ fontWeight: 700 }}>Office hours</td><td>{config.manager.hours}</td></tr>
            <tr>
              <td style={{ fontWeight: 700 }}>Internal notifications</td>
              <td>{config.email.adminEmail} · {config.email.salesEmail}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontSize: 11.5, color: 'var(--muted2)', marginTop: 10 }}>
          Edit the <code>NEXT_PUBLIC_MANAGER_*</code>, <code>ADMIN_EMAIL</code> and{' '}
          <code>SALES_EMAIL</code> variables.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Demo data</div>
        <SeedButton creatorCount={creatorCount} />
      </div>

      {settings.length > 0 && (
        <div className="card">
          <div className="card-title">Stored platform settings</div>
          <table>
            <thead><tr><th>Key</th><th>Value</th></tr></thead>
            <tbody>
              {settings.map((s) => (
                <tr key={s.id}><td><code>{s.key}</code></td><td>{s.value}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {usingLocalStore() && (
        <div className="alert alert-warn" style={{ marginTop: 18 }}>
          <strong>Running on the local JSON store</strong> (<code>./.data/db.json</code>). Fine for
          development and demos, not for production — the file is per-machine and not concurrent-safe.
          Follow <code>docs/SUPABASE_SETUP.md</code> to switch to PostgreSQL; no application code
          changes.
        </div>
      )}
    </>
  );
}
