import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requirePlanFeature } from '@/lib/auth';
import { BrandBriefBuilder, type BrandBriefMatch } from '@/components/brand-brief-builder';
import { saveBrandBriefAction } from '@/lib/services/brand-actions';

export const metadata: Metadata = { title: 'New Campaign Brief' };

const CATEGORIES = ['Beauty', 'Fitness', 'Food & Beverage', 'Tech', 'Fashion', 'Lifestyle'];
const CONTENT_TYPES = [
  'UGC Video',
  'Testimonial',
  'Unboxing',
  'Recipe Integration',
  'Review',
  'Lifestyle Integration',
];

function parseEngagement(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function NewCampaignBriefPage() {
  // The brief builder is a paid entitlement (Standard and above).
  await requirePlanFeature('brief_builder');
  const creators = await db.list('creators', { where: { status: 'active' }, orderBy: 'legacy_id', limit: 100 });
  const matches: BrandBriefMatch[] = creators.map((creator) => ({
    id: creator.id,
    name: creator.name,
    handle: creator.handle,
    platform: creator.platform,
    category: creator.category,
    audience: creator.audience,
    audienceCount: creator.audience_count,
    er: creator.er,
    erValue: parseEngagement(creator.er),
  }));

  return (
    <div className="brand-dashboard-subpage brand-dashboard-wide">
      <div className="brand-dashboard-page-header">
        <div>
          <h1>New Campaign Brief</h1>
          <p>Fill in your requirements — we&apos;ll match the right creators.</p>
        </div>
      </div>
      <BrandBriefBuilder
        action={saveBrandBriefAction}
        categories={CATEGORIES}
        contentTypes={CONTENT_TYPES}
        creators={matches}
      />
    </div>
  );
}
