// ---------------------------------------------------------------------------
// Domain types — mirror supabase/schema.sql 1:1
// ---------------------------------------------------------------------------

export type Role = 'creator' | 'brand' | 'agency' | 'admin';
export type Plan = 'free' | 'standard' | 'pro' | 'enterprise';

export interface User {
  id: string;
  email: string;
  password_hash: string | null;
  full_name: string | null;
  role: Role;
  company_name: string | null;
  country: string | null;
  stripe_customer_id: string | null;
  plan: Plan;
  is_verified: boolean;
  created_at: string;
}

export type CreatorStatus = 'pending' | 'active' | 'inactive' | 'rejected';
export type CreatorSource = 'manual' | 'csv_import' | 'self_apply' | 'crawl';

export interface Creator {
  id: string;
  legacy_id: number | null;
  user_id: string | null;
  name: string;
  handle: string;
  platform: string;
  channel_url: string | null;
  niche: string | null;
  category: string | null;
  tier: string | null;
  audience: string | null;
  audience_count: number | null;
  er: string | null;
  rate_min: number | null; // USD, whole dollars
  rate_max: number | null;
  contact_email: string | null;
  contact_hint: string | null;
  contact_verified: boolean;
  bd_notes: string | null;
  bio: string | null;
  photo_url: string | null;
  avatar_url: string | null;
  accent_bg: string | null;
  emoji: string | null;
  status: CreatorStatus;
  source: CreatorSource;
  import_batch_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatorPortfolio {
  id: string;
  creator_id: string;
  type: 'image' | 'video';
  url: string;
  thumbnail: string | null;
  youtube_id: string | null;
  label: string | null;
  sort_order: number;
  created_at: string;
}

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed';

export interface Campaign {
  id: string;
  brand_id: string | null;
  brand_name: string | null;
  title: string;
  category: string | null;
  content_type: string | null;
  platform: string | null;
  spots_total: number;
  spots_filled: number;
  budget_usd: number | null;
  rate_label: string | null;
  brief_text: string | null;
  emoji: string | null;
  accent_bg: string | null;
  status: CampaignStatus;
  published_at: string | null;
  created_at: string;
}

export type DealStatus =
  | 'pending_payment'
  | 'negotiating'
  | 'brief_sent'
  | 'content_in_review'
  | 'approved'
  | 'published'
  | 'completed'
  | 'overdue'
  | 'cancelled';

export type PaymentStatus = 'unpaid' | 'paid' | 'refunded' | 'failed';

/** Response state for the creator invite sent after a brand pays. */
export type CreatorResponseStatus = 'pending' | 'accepted' | 'declined' | 'expired';
export type RefundStatus = 'not_required' | 'pending' | 'refunded' | 'failed';
export type PayoutStatus = 'not_due' | 'pending' | 'paid' | 'failed';

export interface Deal {
  id: string;
  deal_ref: string; // BM-2026-0001
  campaign_id: string | null;
  creator_id: string;
  brand_id: string | null;
  brand_name: string | null;
  brand_email: string | null;
  content_type: string | null;
  deliverables: string | null;
  quantity: number;
  unit_price_usd: number; // whole dollars
  subtotal_usd: number;
  platform_fee_usd: number;
  /** Fee rate actually charged, so an old deal never re-renders at a new rate. */
  platform_fee_percent: number;
  tax_usd: number;
  total_usd: number;
  currency: string;
  status: DealStatus;
  payment_status: PaymentStatus;
  payment_provider: string | null;
  payment_ref: string | null;
  due_date: string | null;
  brief: string | null;
  notes: string | null;
  origin_country: string | null;
  creator_notified_at: string | null;
  /** Optional so legacy JSON rows remain readable before the migration runs. */
  creator_response_status?: CreatorResponseStatus;
  creator_response_token_hash?: string | null;
  creator_response_expires_at?: string | null;
  creator_responded_at?: string | null;
  refund_status?: RefundStatus;
  refund_reason?: string | null;
  refunded_at?: string | null;
  payout_status?: PayoutStatus;
  payout_ref?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  invoice_no: string; // BM-INV-2026-0001
  deal_id: string;
  brand_id: string | null;
  bill_to_name: string;
  bill_to_email: string;
  bill_to_company: string | null;
  bill_to_address: string | null;
  subtotal_usd: number;
  platform_fee_usd: number;
  platform_fee_percent: number;
  tax_usd: number;
  total_usd: number;
  currency: string;
  status: 'draft' | 'paid' | 'void' | 'refunded';
  issued_at: string;
  paid_at: string | null;
  payment_provider: string | null;
  payment_ref: string | null;
  created_at: string;
}

export type ApplicantStatus = 'pending' | 'approved' | 'rejected';

export interface Applicant {
  id: string;
  /** Null for the public "Apply as a Creator" roster form. */
  campaign_id: string | null;
  name: string;
  handle: string | null;
  platform: string | null;
  channel_url: string | null;
  niche: string | null;
  audience: string | null;
  er: string | null;
  rate: string | null;
  email: string;
  phone: string | null;
  photo_url: string | null;
  video_url: string | null;
  notes: string | null;
  status: ApplicantStatus;
  admin_notes: string | null;
  creator_id: string | null;
  country: string | null;
  applied_at: string;
}

export type PartnershipStatus = 'new' | 'in_discussion' | 'converted' | 'closed';

export interface PartnershipRequest {
  id: string;
  name: string | null;
  company: string | null;
  email: string;
  phone: string | null;
  type: string | null;
  budget: string | null;
  description: string | null;
  status: PartnershipStatus;
  assigned_to: string | null;
  source: string;
  country: string | null;
  created_at: string;
}

export type BookingRequestStatus =
  | 'new'
  | 'contacted'
  | 'quoted'
  | 'converted'
  | 'closed';

/**
 * Lead captured when a visitor OUTSIDE the payment-allowed region tries to
 * book. They cannot check out, so we collect their details and the account
 * manager follows up manually. (Requirement #2)
 */
export interface BookingRequest {
  id: string;
  request_ref: string; // BM-REQ-2026-0001
  creator_id: string | null;
  creator_name: string | null;
  campaign_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  website: string | null;
  preferred_contact: string | null; // email | phone | whatsapp | zalo
  budget: string | null;
  content_type: string | null;
  quantity: number | null;
  message: string | null;
  country: string | null;
  region_blocked: boolean;
  status: BookingRequestStatus;
  admin_notes: string | null;
  handled_by: string | null;
  created_at: string;
}

export interface ContactMessage {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company: string | null;
  inquiry_type: string | null;
  budget: string | null;
  message: string | null;
  country: string | null;
  status: 'new' | 'in_progress' | 'closed';
  created_at: string;
}

export interface ImportBatch {
  id: string;
  filename: string | null;
  total_rows: number;
  imported: number;
  duplicates: number;
  errors: number;
  status: string;
  imported_by: string | null;
  created_at: string;
}

export interface EmailLog {
  id: string;
  to_email: string;
  from_email: string | null;
  subject: string;
  template: string | null;
  html: string | null;
  provider: string;
  provider_id: string | null;
  status: 'sent' | 'failed' | 'logged';
  error: string | null;
  related_type: string | null;
  related_id: string | null;
  created_at: string;
}

export interface SavedCreator {
  id: string;
  user_id: string;
  creator_id: string;
  created_at: string;
}

export interface ContactReveal {
  id: string;
  user_id: string;
  /** Exactly one of creator_id or applicant_id is set. */
  creator_id: string | null;
  applicant_id?: string | null;
  /** UTC calendar day, so the daily quota counts distinct creators per day. */
  reveal_date: string;
  created_at: string;
}

export type UpgradeRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type UpgradeRequestSource = 'self_serve' | 'sales';

/**
 * A brand asking to move to a higher plan.
 *
 * Self-serve tiers create one of these only when Stripe is not configured;
 * with a live key the Checkout Session applies the plan and the row is closed
 * automatically. Sales-led tiers (Enterprise) always go through this table.
 */
export interface UpgradeRequest {
  id: string;
  user_id: string;
  user_email: string;
  company_name: string | null;
  from_plan: Plan;
  to_plan: Plan;
  source: UpgradeRequestSource;
  status: UpgradeRequestStatus;
  note: string | null;
  checkout_session_id: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}

export interface Tables {
  users: User;
  creators: Creator;
  creator_portfolio: CreatorPortfolio;
  campaigns: Campaign;
  deals: Deal;
  invoices: Invoice;
  applicants: Applicant;
  partnership_requests: PartnershipRequest;
  booking_requests: BookingRequest;
  contact_messages: ContactMessage;
  import_batches: ImportBatch;
  email_log: EmailLog;
  saved_creators: SavedCreator;
  contact_reveals: ContactReveal;
  upgrade_requests: UpgradeRequest;
  settings: Setting;
}

export type TableName = keyof Tables;
