import type { Metadata } from 'next';
import { BrandCreatorsView, type BrandCreatorSearchParams } from '@/components/brand-creators-view';

export const metadata: Metadata = { title: 'Browse Creators' };

export default async function DashboardCreatorsPage({
  searchParams,
}: {
  searchParams: Promise<BrandCreatorSearchParams>;
}) {
  return <BrandCreatorsView searchParams={await searchParams} />;
}
