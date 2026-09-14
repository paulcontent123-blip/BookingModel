import type { Brand, BrandStatus } from '@/lib/types';

export const BRAND_INDUSTRIES = [
  'Beauty & Skincare',
  'Fashion & Apparel',
  'Food & Beverage',
  'Health & Wellness',
  'Technology & SaaS',
  'Home & Lifestyle',
  'Retail & E-commerce',
  'Financial Services',
  'Travel & Hospitality',
  'Media & Entertainment',
  'Agency',
  'Other',
] as const;

export const BRAND_COMPANY_SIZES = [
  '1–10',
  '11–50',
  '51–200',
  '201–500',
  '501–1,000',
  '1,001+',
] as const;

export const BRAND_COUNTRIES = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'AU', label: 'Australia' },
  { value: 'Other', label: 'Other / International' },
] as const;

export const US_STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
  ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'],
  ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'],
  ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
  ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'],
  ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'],
  ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
  ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'],
  ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'], ['WY', 'Wyoming'], ['DC', 'District of Columbia'],
] as const;

export const BRAND_STATUSES: BrandStatus[] = ['active', 'inactive', 'pending'];

export type BrandProfileFields = Omit<
  Brand,
  'id' | 'user_id' | 'created_at' | 'updated_at'
>;

export type BrandProfileParseResult =
  | { fields: BrandProfileFields; error?: undefined }
  | { fields?: undefined; error: string };

function value(formData: FormData, name: string): string {
  const raw = formData.get(name);
  return typeof raw === 'string' ? raw.trim() : '';
}

interface ParsedOptional {
  value: string | null;
  error: string | null;
}

function optionalText(
  formData: FormData,
  name: string,
  label: string,
  maxLength: number,
): ParsedOptional {
  const result = value(formData, name);
  if (result.length > maxLength) {
    return { value: null, error: `${label} must be ${maxLength} characters or fewer.` };
  }
  return { value: result || null, error: null };
}

function optionalUrl(
  formData: FormData,
  name: string,
  label: string,
  maxLength: number,
): ParsedOptional {
  const result = value(formData, name);
  if (!result) return { value: null, error: null };
  if (result.length > maxLength) {
    return { value: null, error: `${label} must be ${maxLength} characters or fewer.` };
  }

  try {
    const url = new URL(result);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { value: null, error: `${label} must start with http:// or https://.` };
    }
    if (url.username || url.password) {
      return { value: null, error: `${label} must not contain login credentials.` };
    }
  } catch {
    return { value: null, error: `${label} must be a valid URL.` };
  }
  return { value: result, error: null };
}

/** Parses and validates the fields shared by the brand and admin forms. */
export function brandFieldsFrom(
  formData: FormData,
  existing?: Partial<Brand>,
): BrandProfileParseResult {
  const brandName = value(formData, 'brand_name');
  if (!brandName) return { error: 'Brand name is required.' };
  if (brandName.length > 120) return { error: 'Brand name must be 120 characters or fewer.' };

  const legalName = optionalText(formData, 'legal_name', 'Legal name', 180);
  const website = optionalUrl(formData, 'website', 'Website', 300);
  const description = optionalText(formData, 'description', 'Description', 2000);
  const city = optionalText(formData, 'city', 'City', 100);
  const state = optionalText(formData, 'state', 'State', 100);
  const timezone = optionalText(formData, 'timezone', 'Timezone', 100);
  const contactName = optionalText(formData, 'contact_name', 'Contact name', 120);
  const contactPhone = optionalText(formData, 'contact_phone', 'Phone', 40);
  const linkedinUrl = optionalUrl(formData, 'linkedin_url', 'LinkedIn URL', 300);
  const instagramUrl = optionalUrl(formData, 'instagram_url', 'Instagram URL', 300);
  const tiktokUrl = optionalUrl(formData, 'tiktok_url', 'TikTok URL', 300);

  const textErrors = [
    legalName, website, description, city, state, timezone, contactName, contactPhone,
    linkedinUrl, instagramUrl, tiktokUrl,
  ];
  const firstError = textErrors.find((item) => item.error)?.error;
  if (firstError) return { error: firstError };

  const contactEmail = value(formData, 'contact_email');
  if (contactEmail && (contactEmail.length > 180 || !/^\S+@\S+\.\S+$/.test(contactEmail))) {
    return { error: 'Contact email must be a valid email address.' };
  }

  const country = value(formData, 'country') || existing?.country || 'US';
  const industry = value(formData, 'industry') || null;
  const companySize = value(formData, 'company_size') || null;
  const statusValue = value(formData, 'status');
  const status = BRAND_STATUSES.includes(statusValue as BrandStatus)
    ? (statusValue as BrandStatus)
    : (existing?.status ?? 'active');
  const avatarValue = formData.get('avatar_url');
  const avatarUrl = avatarValue === null
    ? (existing?.avatar_url ?? null)
    : value(formData, 'avatar_url') || null;

  if (avatarUrl) {
    if (avatarUrl.length > 600) return { error: 'Avatar URL must be 600 characters or fewer.' };
    try {
      const parsed = new URL(avatarUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { error: 'Avatar URL must start with http:// or https://.' };
      }
      if (parsed.username || parsed.password) {
        return { error: 'Avatar URL must not contain login credentials.' };
      }
    } catch {
      return { error: 'Avatar URL must be a valid URL.' };
    }
  }

  return {
    fields: {
      brand_name: brandName,
      legal_name: legalName.value,
      website: website.value,
      industry,
      description: description.value,
      company_size: companySize,
      country,
      state: state.value,
      city: city.value,
      timezone: timezone.value,
      contact_name: contactName.value,
      contact_email: contactEmail || null,
      contact_phone: contactPhone.value,
      linkedin_url: linkedinUrl.value,
      instagram_url: instagramUrl.value,
      tiktok_url: tiktokUrl.value,
      avatar_url: avatarUrl,
      status,
    },
  };
}

export function brandInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'B';
}
