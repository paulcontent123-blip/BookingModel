import { ApplicantQueue } from '@/components/admin/applicant-queue';

export const metadata = { title: 'KOL/KOC Applicants' };

export default async function ApplicantsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  return <ApplicantQueue mode="roster" searchParams={await searchParams} />;
}
