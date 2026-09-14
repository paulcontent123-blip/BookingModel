import type { MetadataRoute } from 'next';
import { config } from '@/lib/config';
import { listCreatorsFromDatabase } from '@/lib/creator-data';
import { SOLUTIONS } from '@/lib/solutions';
import { listPublishedNews, listPublishedShowcase } from '@/lib/services/content';
import { BRAND_SHOWCASE_ENABLED } from '@/lib/features';

/**
 * Public sitemap. Everything behind a session — dashboard, admin, checkout,
 * invoices — is deliberately absent and blocked in app/robots.ts as well.
 */

const MAX_CREATOR_URLS = 1000;

function url(path: string): string {
  return new URL(path, config.site.url).toString();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const showcaseStaticEntries: MetadataRoute.Sitemap = BRAND_SHOWCASE_ENABLED
    ? [{ url: url('/showcase'), lastModified: now, changeFrequency: 'weekly', priority: 0.7 }]
    : [];

  const staticEntries: MetadataRoute.Sitemap = [
    { url: url('/'), lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: url('/marketplace'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: url('/campaigns'), lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: url('/solutions'), lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: url('/news'), lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    ...showcaseStaticEntries,
    { url: url('/partnership'), lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: url('/contact'), lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: url('/apply'), lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
  ];

  const solutionEntries: MetadataRoute.Sitemap = SOLUTIONS.map((solution) => ({
    url: url(`/solutions/${solution.slug}`),
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  // A missing database must not take the sitemap down with it.
  const [posts, showcase, creators] = await Promise.all([
    listPublishedNews().catch(() => []),
    BRAND_SHOWCASE_ENABLED ? listPublishedShowcase().catch(() => []) : Promise.resolve([]),
    listCreatorsFromDatabase({ activeOnly: true, limit: MAX_CREATOR_URLS })
      .catch(() => []),
  ]);

  const newsEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: url(`/news/${post.slug}`),
    lastModified: new Date(post.updated_at ?? post.published_at ?? post.created_at),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const showcaseEntries: MetadataRoute.Sitemap = BRAND_SHOWCASE_ENABLED
    ? showcase.map((item) => ({
        url: url(`/showcase/${item.slug}`),
        lastModified: new Date(item.updated_at ?? item.published_at ?? item.created_at),
        changeFrequency: 'monthly',
        priority: 0.7,
      }))
    : [];

  const creatorEntries: MetadataRoute.Sitemap = creators.map((creator) => ({
    url: url(`/creators/${creator.id}`),
    lastModified: new Date(creator.updated_at ?? creator.created_at),
    changeFrequency: 'weekly',
    priority: 0.5,
  }));

  return [
    ...staticEntries,
    ...solutionEntries,
    ...newsEntries,
    ...showcaseEntries,
    ...creatorEntries,
  ];
}
