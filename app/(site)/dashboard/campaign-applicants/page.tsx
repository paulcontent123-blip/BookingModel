import type { Metadata } from 'next';
import { BrandApplicantList } from '@/components/brand-applicant-list';

export const metadata: Metadata = { title: 'Campaign Applicants' };

export default function CampaignApplicantsPage() {
  return <BrandApplicantList mode="campaign" />;
}
