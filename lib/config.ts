// ---------------------------------------------------------------------------
// Central place where every environment variable is read.
// Everything degrades gracefully so the app runs with zero real keys.
// ---------------------------------------------------------------------------

function env(key: string, fallback = ''): string {
  const v = process.env[key];
  if (v === undefined || v === null) return fallback;
  const trimmed = v.trim().replace(/^"(.*)"$/, '$1');
  return trimmed;
}

function num(key: string, fallback: number): number {
  const n = Number(env(key));
  return Number.isFinite(n) ? n : fallback;
}

function list(key: string, fallback: string[]): string[] {
  const raw = env(key);
  if (!raw) return fallback;
  return raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

/** A value is "configured" only when it exists and is not one of our placeholders. */
export function isConfigured(value: string | undefined | null): boolean {
  if (!value) return false;
  const v = value.trim();
  if (!v) return false;
  return !/placeholder|your-project-ref|change_me|^sk_test_PLACEHOLDER/i.test(v);
}

export const config = {
  site: {
    url: env('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000'),
    name: env('NEXT_PUBLIC_SITE_NAME', 'BookingModel'),
  },

  auth: {
    secret: env('AUTH_SECRET', 'dev_only_insecure_secret_change_me'),
    // Keep the public brand session and the internal admin session separate.
    // This prevents an already signed-in brand account from being mistaken
    // for an admin account when the user opens /admin.
    cookieName: env('BRAND_AUTH_COOKIE_NAME', 'bm_brand_session'),
    adminCookieName: env('ADMIN_AUTH_COOKIE_NAME', 'bm_admin_session'),
    maxAgeSeconds: 60 * 60 * 24 * 7,
  },

  supabase: {
    url: env('NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: env('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    serviceKey: env('SUPABASE_SERVICE_ROLE_KEY'),
    get enabled(): boolean {
      if (env('DB_DRIVER').toLowerCase() === 'memory') return false;
      return (
        isConfigured(env('NEXT_PUBLIC_SUPABASE_URL')) &&
        isConfigured(env('SUPABASE_SERVICE_ROLE_KEY'))
      );
    },
  },

  geo: {
    /** Only these countries may book + pay. Everyone else gets the lead form. */
    allowedCountries: list('PAYMENT_ALLOWED_COUNTRIES', ['US', 'CA']),
    /** Countries that get the "our team will contact you" copy. */
    restrictedCountries: list('RESTRICTED_REGION_COUNTRIES', [
      'VN', 'TH', 'ID', 'PH', 'MY', 'SG', 'KH', 'LA', 'MM', 'BN', 'TL',
    ]),
    unknownPolicy: (env('GEO_UNKNOWN_POLICY', 'allow') === 'block'
      ? 'block'
      : 'allow') as 'allow' | 'block',
    providers: list('GEO_PROVIDERS', ['VERCEL', 'CLOUDFLARE', 'IPINFO']).map((p) =>
      p.toLowerCase(),
    ),
    ipinfoToken: env('IPINFO_TOKEN'),
    debug: env('NEXT_PUBLIC_GEO_DEBUG', 'false') === 'true',
    headerName: 'x-bm-country',
    sourceHeaderName: 'x-bm-country-source',
    overrideCookie: 'bm_geo_override',
  },

  payments: {
    provider: env('PAYMENT_PROVIDER', 'mock').toLowerCase(),
    taxPercent: num('TAX_PERCENT', 0),
    invoicePrefix: env('INVOICE_PREFIX', 'BM'),
    stripe: {
      secretKey: env('STRIPE_SECRET_KEY'),
      publishableKey: env('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'),
      webhookSecret: env('STRIPE_WEBHOOK_SECRET'),
      get enabled(): boolean {
        return isConfigured(env('STRIPE_SECRET_KEY'));
      },
    },
  },

  cron: {
    /** Used by the scheduled endpoint that expires unanswered creator invites. */
    secret: env('CRON_SECRET'),
  },

  email: {
    resendKey: env('RESEND_API_KEY'),
    from: env('EMAIL_FROM', 'BookingModel <no-reply@bookingmodel.com>'),
    replyTo: env('EMAIL_REPLY_TO', 'hello@bookingmodel.com'),
    adminEmail: env('ADMIN_EMAIL', 'admin@bookingmodel.com'),
    salesEmail: env('SALES_EMAIL', 'sales@bookingmodel.com'),
    get enabled(): boolean {
      return isConfigured(env('RESEND_API_KEY'));
    },
  },

  manager: {
    name: env('NEXT_PUBLIC_MANAGER_NAME', 'VEA Group — Partnerships Desk'),
    email: env('NEXT_PUBLIC_MANAGER_EMAIL', 'partnerships@bookingmodel.com'),
    phone: env('NEXT_PUBLIC_MANAGER_PHONE', '+1 (302) 555-0142'),
    whatsapp: env('NEXT_PUBLIC_MANAGER_WHATSAPP', '+84 909 000 000'),
    hours: env('NEXT_PUBLIC_MANAGER_HOURS', 'Mon–Fri, 9:00–18:00 EST'),
  },

  cloudinary: {
    cloudName: env('CLOUDINARY_CLOUD_NAME'),
    apiKey: env('CLOUDINARY_API_KEY'),
    apiSecret: env('CLOUDINARY_API_SECRET'),
    folder: env('CLOUDINARY_FOLDER', 'bookingmodel/creators'),
    get enabled(): boolean {
      return isConfigured(env('CLOUDINARY_CLOUD_NAME')) && isConfigured(env('CLOUDINARY_API_KEY'));
    },
  },

  seed: {
    adminEmail: env('SEED_ADMIN_EMAIL', 'admin@bookingmodel.com'),
    adminPassword: env('SEED_ADMIN_PASSWORD', 'Admin@BM2026'),
    brandEmail: env('SEED_BRAND_EMAIL', 'brand@demo.com'),
    brandPassword: env('SEED_BRAND_PASSWORD', 'BrandDemo123'),
  },
};

/** Snapshot of which integrations are live — surfaced in Admin → Settings. */
export function integrationStatus() {
  return [
    {
      key: 'Database',
      value: config.supabase.enabled ? 'Supabase (PostgreSQL)' : 'Local JSON store (.data/db.json)',
      ok: config.supabase.enabled,
      hint: 'NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY',
    },
    {
      key: 'Payments',
      value: config.payments.provider === 'stripe' && config.payments.stripe.enabled
        ? 'Stripe'
        : `Mock provider (${config.payments.provider})`,
      ok: config.payments.provider === 'stripe' && config.payments.stripe.enabled,
      hint: 'STRIPE_SECRET_KEY',
    },
    {
      key: 'Email',
      value: config.email.enabled ? 'Resend' : 'Console + Email log (no key)',
      ok: config.email.enabled,
      hint: 'RESEND_API_KEY',
    },
    {
      key: 'Media',
      value: config.cloudinary.enabled ? 'Cloudinary' : 'Direct URLs (Unsplash/CDN)',
      ok: config.cloudinary.enabled,
      hint: 'CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY',
    },
    {
      key: 'Geo lookup',
      value: isConfigured(config.geo.ipinfoToken)
        ? 'Platform headers + ipinfo.io'
        : 'Platform headers only (Vercel / Cloudflare)',
      ok: true,
      hint: 'IPINFO_TOKEN (optional)',
    },
  ];
}
