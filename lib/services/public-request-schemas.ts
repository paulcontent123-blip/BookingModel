import { z } from 'zod';

export const contactRequestSchema = z.object({
  first_name: z.string().max(80).optional(),
  last_name: z.string().max(80).optional(),
  email: z.string().email('Enter a real email address you can access.'),
  company: z.string().max(160).optional(),
  inquiry_type: z.string().max(80).optional(),
  budget: z.string().max(80).optional(),
  message: z.string().max(4000).optional(),
});

export const partnershipRequestSchema = z.object({
  name: z.string().trim().min(1, 'Your name is required.').max(160),
  company: z.string().trim().max(160).optional(),
  email: z.string().trim().email('Enter a real email address you can access.'),
  phone: z.string().trim().max(60).optional(),
  type: z.string().trim().min(1, 'Choose a partnership type.').max(80),
  budget: z.string().trim().max(80).optional(),
  description: z.string().trim().min(1, 'Tell us about the partnership.').max(4000),
});

export const applicantRequestSchema = z.object({
  campaign_id: z.string().uuid().optional(),
  name: z.string().min(1).max(160),
  handle: z.string().min(1).max(80),
  platform: z.string().min(1).max(40),
  channel_url: z.string().url('Enter a valid channel URL.'),
  niche: z.string().min(1).max(160),
  audience: z.string().max(40).optional(),
  er: z.string().max(20).optional(),
  rate: z.string().max(60).optional(),
  email: z.string().email('Enter a real email address you can access.'),
  phone: z.string().max(60).optional(),
  photo_url: z.string().max(600).optional(),
  video_url: z.string().max(600).optional(),
  notes: z.string().max(3000).optional(),
});

export const bookingRequestSchema = z.object({
  creatorId: z.string().nullish(),
  campaignId: z.string().nullish(),
  fullName: z.string().min(1).max(160),
  email: z.string().email('Enter a real email address you can access.'),
  phone: z.string().max(60).nullish(),
  company: z.string().max(160).nullish(),
  website: z.string().max(300).nullish(),
  preferredContact: z.string().max(40).nullish(),
  budget: z.string().max(80).nullish(),
  contentType: z.string().max(120).nullish(),
  quantity: z.coerce.number().int().min(1).max(500).nullish(),
  message: z.string().max(4000).nullish(),
});

export const contactPendingPayloadSchema = contactRequestSchema.extend({
  country: z.string().nullish(),
});

export const partnershipPendingPayloadSchema = partnershipRequestSchema.extend({
  country: z.string().nullish(),
});

export const applicantPendingPayloadSchema = applicantRequestSchema.extend({
  country: z.string().nullish(),
});

export const bookingPendingPayloadSchema = bookingRequestSchema.extend({
  country: z.string().nullish(),
  regionBlocked: z.boolean(),
});

export type ContactRequestInput = z.infer<typeof contactRequestSchema>;
export type PartnershipRequestInput = z.infer<typeof partnershipRequestSchema>;
export type ApplicantRequestInput = z.infer<typeof applicantRequestSchema>;
export type BookingRequestInput = z.infer<typeof bookingRequestSchema>;
