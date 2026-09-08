import type { Metadata } from 'next';
import { config } from '@/lib/config';
import { resolveGeo } from '@/lib/guard';
import { countryName } from '@/lib/geo';
import { LeadForm, type FieldDef } from '@/components/lead-form';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Request a campaign or ask us anything. We respond within one business day.',
};

const INQUIRY_TYPES = [
  'UGC / Creator Campaign',
  'Influencer Marketing',
  'E-Commerce Operation',
  'Advertising (TikTok / Meta)',
  'Production & Livestream',
  'Brand Identity & SEO',
  'Partnership / Collab',
  'Creator — Apply to join',
  'Other',
];

const BUDGETS = [
  'Under $3,000',
  '$3,000 to $10,000',
  '$10,000 to $30,000',
  '$30,000+',
  'Not sure yet',
];

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const [{ type }, geo] = await Promise.all([searchParams, resolveGeo()]);

  const preselected = INQUIRY_TYPES.find(
    (t) => type && t.toLowerCase().includes(type.toLowerCase().split(' ')[0]!),
  );

  const fields: FieldDef[] = [
    { name: 'first_name', label: 'First name', required: true, half: true },
    { name: 'last_name', label: 'Last name', required: true, half: true },
    { name: 'email', label: 'Email', type: 'email', required: true, half: true },
    { name: 'company', label: 'Company / Brand', half: true },
    {
      name: 'inquiry_type',
      label: 'Inquiry type',
      type: 'select',
      options: INQUIRY_TYPES,
      defaultValue: preselected,
      half: true,
    },
    { name: 'budget', label: 'Monthly budget (USD)', type: 'select', options: BUDGETS, half: true },
    {
      name: 'message',
      label: 'Tell us about your project',
      type: 'textarea',
      rows: 5,
      placeholder: 'Product, goals, timeline, platforms you care about…',
    },
  ];

  return (
    <section className="sec">
      <div className="sec-eye">Get in touch</div>
      <h1 className="sec-h">
        Request a Campaign or <strong>ask us anything</strong>
      </h1>
      <p className="sec-p">
        Brand, creator, or partner — we respond within one business day.
      </p>

      <div className="contact-wrap">
        <LeadForm
          action="/api/contact"
          fields={fields}
          submitLabel="Send Request →"
          successTitle="Request sent"
          successBody={
            <>
              <strong>Thank you.</strong> Our team will reply to your email within one business day.
              For anything urgent, call {config.manager.phone}.
            </>
          }
        >
          <div className="form-title">Campaign Request / Inquiry</div>
        </LeadForm>

        <div className="contact-info">
          <div className="ci-item">
            <span className="ci-ico">✉️</span>
            <div>
              <div className="ci-title">Email</div>
              <div className="ci-val">
                <a href={`mailto:${config.manager.email}`} style={{ color: 'var(--blue)' }}>
                  {config.manager.email}
                </a>
              </div>
            </div>
          </div>

          <div className="ci-item">
            <span className="ci-ico">📞</span>
            <div>
              <div className="ci-title">Phone</div>
              <div className="ci-val">{config.manager.phone}</div>
            </div>
          </div>

          <div className="ci-item">
            <span className="ci-ico">💬</span>
            <div>
              <div className="ci-title">WhatsApp / Zalo</div>
              <div className="ci-val">{config.manager.whatsapp}</div>
            </div>
          </div>

          <div className="ci-item">
            <span className="ci-ico">🕘</span>
            <div>
              <div className="ci-title">Office hours</div>
              <div className="ci-val">{config.manager.hours}</div>
            </div>
          </div>

          <div className="ci-item">
            <span className="ci-ico">🌎</span>
            <div>
              <div className="ci-title">Where we take payment</div>
              <div className="ci-val">
                Self-serve checkout is available in{' '}
                {config.geo.allowedCountries.map(countryName).join(' and ')}.
                {!geo.canTransact && (
                  <>
                    {' '}
                    You are browsing from <strong>{countryName(geo.country)}</strong> — your booking
                    is handled personally by {config.manager.name}.
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
