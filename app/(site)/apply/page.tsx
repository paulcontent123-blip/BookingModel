import type { Metadata } from 'next';
import { LeadForm, type FieldDef } from '@/components/lead-form';
import { PLATFORMS } from '@/lib/utils';
import { db } from '@/lib/db';

export const metadata: Metadata = {
  title: 'Apply as a Creator',
  description:
    'Join the BookingModel roster. Every profile is reviewed by hand — decisions within 24 to 48 hours.',
};

/** Fields follow TechSpec §5.1 exactly. */
const fields: FieldDef[] = [
  { name: 'name', label: 'Full name', required: true, half: true },
  { name: 'handle', label: 'Handle', required: true, placeholder: '@myhandle', half: true },
  {
    name: 'platform',
    label: 'Main platform',
    type: 'select',
    required: true,
    options: [...PLATFORMS, 'Other'],
    half: true,
  },
  {
    name: 'channel_url',
    label: 'Channel URL',
    type: 'url',
    required: true,
    placeholder: 'https://tiktok.com/@myhandle',
    half: true,
  },
  {
    name: 'niche',
    label: 'Niche',
    required: true,
    placeholder: 'e.g. Healthy Meal Prep / Budget',
  },
  { name: 'audience', label: 'Followers', placeholder: '82K', half: true, hint: 'Approximate is fine' },
  { name: 'er', label: 'Engagement rate', placeholder: '6.2%', half: true, hint: 'If you know it' },
  { name: 'rate', label: 'Your rate', placeholder: '$150–350 per video', half: true },
  { name: 'email', label: 'Email', type: 'email', required: true, half: true },
  { name: 'phone', label: 'Phone / WhatsApp', type: 'tel', half: true },
  {
    name: 'photo_url',
    label: 'Profile photo URL',
    type: 'url',
    half: true,
    hint: 'Optional — a direct link to your photo',
  },
  {
    name: 'video_url',
    label: 'Portfolio video (YouTube)',
    type: 'url',
    placeholder: 'https://youtube.com/watch?v=…',
    hint: 'Optional — we embed this on your profile',
  },
  {
    name: 'notes',
    label: 'Anything else to share',
    type: 'textarea',
    rows: 4,
    placeholder: 'Brands you have worked with, content style, availability…',
  },
];

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const { campaign } = await searchParams;
  const campaignRecord = campaign ? await db.get('campaigns', campaign) : null;
  const openCampaign = campaignRecord &&
    campaignRecord.status === 'active' &&
    campaignRecord.spots_filled < campaignRecord.spots_total
    ? campaignRecord
    : null;

  return (
    <section className="sec" style={{ maxWidth: 760 }}>
      <div className="sec-eye">Creators</div>
      <h1 className="sec-h">
        {openCampaign ? <>Apply to <strong>{openCampaign.title}</strong></> : <>Apply to the <strong>BookingModel roster</strong></>}
      </h1>
      <p className="sec-p">
        {openCampaign
          ? 'Share your creator details for this campaign. The brand sees your basic profile first and contact details remain private.'
          : 'We are not an open sign-up platform — every profile is vetted by hand. Submit your details and our team decides within 24 to 48 hours. There is no fee to apply.'}
      </p>

      {openCampaign && (
        <div className="alert alert-info">
          Applying to <strong>{openCampaign.title}</strong> for {openCampaign.brand_name}.
          Your application will be shown to that brand without exposing your contact details.
        </div>
      )}

      <LeadForm
        action="/api/applicants"
        fields={fields}
        submitLabel={openCampaign ? 'Apply to this campaign →' : 'Submit application →'}
        hidden={{ campaign_id: openCampaign?.id }}
        successTitle="Application received"
        successBody={
          <>
            <strong>Thank you.</strong> We emailed you a confirmation. Our team reviews every
            profile manually and replies within 24 to 48 hours. If this was a campaign application,
            the brand can review your basic profile without seeing your contact details.
          </>
        }
      >
        <div className="form-title">Creator application</div>
      </LeadForm>
    </section>
  );
}
