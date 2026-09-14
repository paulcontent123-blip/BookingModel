import type { MetadataRoute } from 'next';
import { config } from '@/lib/config';

/**
 * Anything that needs a session, or that only exists as a form endpoint, is
 * disallowed. The marketing site and the creator marketplace stay crawlable.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/api',
          '/dashboard',
          '/booking',
          '/invoices',
          '/login',
          '/signup',
          '/book',
        ],
      },
    ],
    sitemap: new URL('/sitemap.xml', config.site.url).toString(),
    host: config.site.url,
  };
}
