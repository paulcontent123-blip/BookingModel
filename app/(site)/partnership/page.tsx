import type { Metadata } from 'next';
import Link from 'next/link';
import { LeadForm, type FieldDef } from '@/components/lead-form';
import { listPublishedPartners } from '@/lib/services/partners';

export const metadata: Metadata = {
  title: 'Partnership & Collaboration',
  description:
    'Co-marketing, tech integrations, agency reselling, affiliate and gifting programs across the creator economy.',
};

function formFields(partnershipTypes: string[]): FieldDef[] {
  return [
    { name: 'name', label: 'Your name', required: true, half: true },
    { name: 'email', label: 'Email', type: 'email', required: true, half: true },
    { name: 'company', label: 'Company', half: true },
    { name: 'phone', label: 'Phone', type: 'tel', half: true },
    {
      name: 'type',
      label: 'Partnership type',
      type: 'select',
      required: true,
      options: partnershipTypes,
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
}

export default async function PartnershipPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const partners = await listPublishedPartners();
  const selectedType = partners.find((partner) => partner.name === type)?.name;
  const fields = formFields(partners.map((partner) => partner.name)).map((field) =>
    field.name === 'type' ? { ...field, defaultValue: selectedType } : field,
  );

  return (
    <section className="sec">
      <div className="sec-eye">Partnership &amp; Collaboration</div>
      <h1 className="sec-h">Let&rsquo;s <strong>build something together</strong></h1>
      <p className="sec-p">
        Not booking a campaign? We are open to co-marketing, tech integrations and strategic
        alliances across the creator economy.
      </p>

      <div className="partner-grid">
        {partners.map((partner) => (
          <div className={`pcard${selectedType === partner.name ? ' selected' : ''}`} key={partner.id}>
            <div className="pcard-ico">{partner.icon ?? '🤝'}</div>
            <div className="pcard-title">{partner.name}</div>
            <div className="pcard-desc">{partner.description ?? ''}</div>
            <Link
              href={`/partnership?type=${encodeURIComponent(partner.name)}#partnership-form`}
              className="pcard-btn"
            >
              {partner.cta_label ?? 'Reach out →'}
            </Link>
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
