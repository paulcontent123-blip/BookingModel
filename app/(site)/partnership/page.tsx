import type { Metadata } from 'next';
import { LeadForm, type FieldDef } from '@/components/lead-form';

export const metadata: Metadata = {
  title: 'Partnership & Collaboration',
  description:
    'Co-marketing, tech integrations, agency reselling, affiliate and gifting programs across the creator economy.',
};

const TYPES = [
  { icon: '🤝', title: 'Co-Marketing & Brand Collab', desc: 'Joint campaigns, co-branded content and cross-promotion to our combined audience of brands and creators.', cta: 'Reach out →' },
  { icon: '🔗', title: 'Tech & Platform Integration', desc: 'API integrations, data partnerships and software tools embedded in our creator workflow.', cta: 'Reach out →' },
  { icon: '🌐', title: 'Agency & Reseller Partnership', desc: 'White-label our creator discovery and booking infrastructure. Revenue sharing for qualified partners.', cta: 'Reach out →' },
  { icon: '📣', title: 'Affiliate & Referral Program', desc: 'Earn commission by referring brands to BookingModel. Monthly payouts, co-branded landing pages.', cta: 'Join program →' },
  { icon: '🎓', title: 'Creator Academy Partner', desc: 'Educators and coaches who teach UGC — partner for joint workshops, certification and community access.', cta: 'Partner with us →' },
  { icon: '📦', title: 'Product Gifting Program', desc: 'Send products to our creator roster for organic reviews and authentic UGC with content output guarantees.', cta: 'Start gifting →' },
];

const fields: FieldDef[] = [
  { name: 'name', label: 'Your name', required: true, half: true },
  { name: 'email', label: 'Email', type: 'email', required: true, half: true },
  { name: 'company', label: 'Company', half: true },
  { name: 'phone', label: 'Phone', type: 'tel', half: true },
  {
    name: 'type',
    label: 'Partnership type',
    type: 'select',
    required: true,
    options: TYPES.map((t) => t.title),
  },
  {
    name: 'budget',
    label: 'Indicative budget / deal size',
    type: 'select',
    options: ['Under $5,000', '$5,000 – $25,000', '$25,000 – $100,000', '$100,000+', 'Revenue share', 'Not applicable'],
  },
  {
    name: 'description',
    label: 'Tell us about the partnership',
    type: 'textarea',
    rows: 5,
    required: true,
    placeholder: 'What you have in mind, who your audience is, and what a good outcome looks like.',
  },
];

export default function PartnershipPage() {
  return (
    <section className="sec">
      <div className="sec-eye">Partnership &amp; Collaboration</div>
      <h1 className="sec-h">Let&rsquo;s <strong>build something together</strong></h1>
      <p className="sec-p">
        Not booking a campaign? We are open to co-marketing, tech integrations and strategic
        alliances across the creator economy.
      </p>

      <div className="partner-grid">
        {TYPES.map((t) => (
          <div className="pcard" key={t.title}>
            <div className="pcard-ico">{t.icon}</div>
            <div className="pcard-title">{t.title}</div>
            <div className="pcard-desc">{t.desc}</div>
            <a href="#partnership-form" className="pcard-btn">{t.cta}</a>
          </div>
        ))}
      </div>

      <div id="partnership-form" style={{ maxWidth: 620, marginTop: 44 }}>
        <LeadForm
          action="/api/partnership"
          fields={fields}
          submitLabel="Send partnership request →"
          successTitle="Request received"
          successBody={
            <>
              <strong>Thank you.</strong> Our partnerships team reviews every request and replies
              within one business day.
            </>
          }
        >
          <div className="form-title">Partnership inquiry</div>
        </LeadForm>
      </div>
    </section>
  );
}
