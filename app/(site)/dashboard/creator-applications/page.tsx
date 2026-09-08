import type { Metadata } from 'next';
import { BrandApplicantList } from '@/components/brand-applicant-list';

export const metadata: Metadata = { title: 'Creator Applications' };

export default function CreatorApplicationsPage() {
  return <BrandApplicantList mode="roster" />;
}
