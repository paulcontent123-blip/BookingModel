import { ApplicantQueue } from '@/components/admin/applicant-queue';

export const metadata = { title: 'Campaign Applicants' };

export default async function CampaignApplicantsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  return <ApplicantQueue mode="campaign" searchParams={await searchParams} />;
}
