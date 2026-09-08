import { config } from '@/lib/config';
import { PLANS, lowestPlanWith, planName } from '@/lib/plans';
import type {
  Applicant,
  BookingRequest,
  Creator,
  Deal,
  Invoice,
  PartnershipRequest,
  Plan,
  UpgradeRequest,
} from '@/lib/types';
import { feePercentLabel, formatDate, money } from '@/lib/utils';

/** Shared shell so every message looks like it came from the same company. */
function shell(opts: { preheader: string; heading: string; body: string; cta?: { label: string; url: string } }) {
  const { preheader, heading, body, cta } = opts;
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F2F2F2;font-family:Arial,Helvetica,sans-serif;color:#0A0A0A;">
<span style="display:none;font-size:1px;color:#F2F2F2;">${preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F2F2;padding:28px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#FFFFFF;border:1px solid #E2E2E2;border-radius:8px;overflow:hidden;">
    <tr><td style="background:#0A0A0A;padding:18px 24px;">
      <span style="font-size:16px;font-weight:800;color:#FFFFFF;letter-spacing:-0.3px;">Booking<span style="color:#0057FF;">Model</span></span>
      <span style="float:right;font-size:11px;color:rgba(255,255,255,.45);padding-top:4px;">VEA Group</span>
    </td></tr>
    <tr><td style="padding:26px 24px 8px;">
      <h1 style="margin:0 0 14px;font-size:20px;line-height:1.3;font-weight:800;color:#0A0A0A;">${heading}</h1>
      <div style="font-size:14px;line-height:1.7;color:#333333;">${body}</div>
    </td></tr>
    ${cta ? `<tr><td style="padding:8px 24px 26px;">
      <a href="${cta.url}" style="display:inline-block;background:#0057FF;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:4px;">${cta.label}</a>
    </td></tr>` : '<tr><td style="height:18px"></td></tr>'}
    <tr><td style="background:#F8F8F8;border-top:1px solid #E2E2E2;padding:16px 24px;font-size:11.5px;color:#8C8C8C;line-height:1.6;">
      BookingModel.com — Creator marketing platform for North American brands.<br>
      Questions? Reply to this email or write to ${config.email.replyTo}.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

function table(rows: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;font-size:13.5px;">
  ${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #EDEDED;color:#5C5C5C;width:42%;">${k}</td><td style="padding:8px 0;border-bottom:1px solid #EDEDED;font-weight:600;color:#0A0A0A;">${v}</td></tr>`,
    )
    .join('')}
</table>`;
}

const esc = (s: unknown) =>
  String(s ?? '—').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]!);

export interface Message {
  to: string;
  subject: string;
  html: string;
  template: string;
}

// ---------------------------------------------------------------------------
// Requirement #5 — notify the creator when a brand books them
// ---------------------------------------------------------------------------
export function creatorBookedEmail(
  deal: Deal,
  creator: Creator,
  invoice: Invoice,
  links: { acceptUrl: string; declineUrl: string },
): Message {
  const acceptButton = `<a href="${esc(links.acceptUrl)}" style="display:inline-block;background:#00875A;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:4px;margin-right:8px;">Accept booking</a>`;
  const declineButton = `<a href="${esc(links.declineUrl)}" style="display:inline-block;background:#FFFFFF;color:#C62828;text-decoration:none;font-weight:700;font-size:14px;padding:11px 20px;border:1px solid #C62828;border-radius:4px;">Decline booking</a>`;
  return {
    to: creator.contact_email ?? config.email.adminEmail,
    template: 'creator_booked',
    subject: `Action required — booking ${deal.deal_ref} from ${deal.brand_name ?? 'a brand'}`,
    html: shell({
      preheader: `${deal.brand_name ?? 'A brand'} booked you for ${deal.quantity}x ${deal.content_type ?? 'content'}.`,
      heading: `Hi ${esc(creator.name.split(' ')[0])} — please review this booking`,
      body: `<p><strong>${esc(deal.brand_name ?? 'A brand')}</strong> has paid for a booking with you through BookingModel. Review the campaign information below and choose whether you can take the booking.</p>
      ${table([
        ['Booking reference', esc(deal.deal_ref)],
        ['Brand', esc(deal.brand_name)],
        ['Brand email', esc(deal.brand_email)],
        ['Billing company', esc(invoice.bill_to_company)],
        ['Brand address', esc(invoice.bill_to_address)],
        ['Deliverables', `${deal.quantity}x ${esc(deal.content_type)}`],
        ['Your rate', money(deal.subtotal_usd)],
        ['Due date', formatDate(deal.due_date)],
      ])}
      <p style="margin:0 0 6px;font-weight:700;">Campaign brief</p>
      <p style="margin:0;padding:12px 14px;background:#F8F8F8;border-left:3px solid #0057FF;white-space:pre-wrap;">${esc(deal.brief ?? 'The brand will share the full brief shortly.')}</p>
      <p style="margin:18px 0 10px;font-weight:700;">Respond within 48 hours</p>
      <p style="margin:0 0 16px;">If you accept, the brand will receive a confirmation and the booking will move to the creator payout queue. If you decline or do not respond before the deadline, the brand will be notified and the payment will be refunded.</p>
      <p style="margin:0;">${acceptButton}${declineButton}</p>`,
    }),
  };
}

// ---------------------------------------------------------------------------
// Requirement #3 — payment success + invoice for the brand
// ---------------------------------------------------------------------------
export function bookingConfirmedEmail(deal: Deal, creator: Creator, invoice: Invoice): Message {
  return {
    to: deal.brand_email ?? config.email.adminEmail,
    template: 'booking_confirmed',
    subject: `Payment received — creator confirmation pending (invoice ${invoice.invoice_no})`,
    html: shell({
      preheader: `Payment received for ${deal.deal_ref}. Waiting for ${creator.name} to respond.`,
      heading: 'Payment received — creator confirmation pending',
      body: `<p>Thank you. Your payment has been processed and <strong>${esc(creator.name)}</strong> has received the campaign brief and contact details.</p>
      ${table([
        ['Booking reference', esc(deal.deal_ref)],
        ['Invoice', esc(invoice.invoice_no)],
        ['Creator', `${esc(creator.name)} (${esc(creator.handle)})`],
        ['Deliverables', `${deal.quantity}x ${esc(deal.content_type)}`],
        ['Subtotal', money(deal.subtotal_usd)],
        [`Platform fee (${feePercentLabel(deal.platform_fee_percent)}%)`, money(deal.platform_fee_usd)],
        ['Total paid', `<span style="color:#00875A;">${money(deal.total_usd)}</span>`],
      ])}
      <p>The creator has 48 hours to accept. If they decline or do not respond in time, the booking will be cancelled and the payment will be refunded. You can track every status change from your dashboard.</p>`,
      cta: { label: 'View invoice', url: `${config.site.url}/invoices/${invoice.invoice_no}` },
    }),
  };
}

export function creatorAcceptedEmail(deal: Deal, creator: Creator): Message {
  return {
    to: deal.brand_email ?? config.email.adminEmail,
    template: 'creator_accepted',
    subject: `Creator accepted booking ${deal.deal_ref} — ${creator.name}`,
    html: shell({
      preheader: `${creator.name} accepted your booking ${deal.deal_ref}.`,
      heading: 'Your creator accepted the booking',
      body: `<p><strong>${esc(creator.name)}</strong> accepted your booking. The VEA team can now coordinate the brief and release the creator payout according to your agreement.</p>
      ${table([
        ['Booking reference', esc(deal.deal_ref)],
        ['Creator', `${esc(creator.name)} (${esc(creator.handle)})`],
        ['Contact email', esc(creator.contact_email)],
        ['Contact note', esc(creator.contact_hint)],
        ['Platform', esc(creator.platform)],
        ['Channel URL', creator.channel_url ? `<a href="${esc(creator.channel_url)}" style="color:#0057FF;">${esc(creator.channel_url)}</a>` : '—'],
        ['Deliverables', `${deal.quantity}x ${esc(deal.content_type)}`],
        ['Due date', formatDate(deal.due_date)],
        ['Amount', money(deal.subtotal_usd)],
      ])}
      <p>The booking is now in the creator payout queue. Our team will update you when the next payment milestone is recorded.</p>`,
      cta: { label: 'Open dashboard', url: `${config.site.url}/dashboard/bookings` },
    }),
  };
}

export function bookingRefundedEmail(
  deal: Deal,
  creator: Creator,
  invoice: Invoice,
  reason: 'declined' | 'expired',
  refundOk: boolean,
): Message {
  const declined = reason === 'declined';
  const headline = declined ? 'The creator declined your booking' : 'The booking expired without a response';
  const refundText = refundOk
    ? `The payment of <strong>${money(deal.total_usd)}</strong> has been sent for refund to the original payment method.`
    : `The automatic refund could not be completed yet. Our admin team has been notified and will review the refund for <strong>${money(deal.total_usd)}</strong>.`;
  return {
    to: deal.brand_email ?? config.email.adminEmail,
    template: declined ? 'booking_declined' : 'booking_expired',
    subject: `${headline} — ${deal.deal_ref}`,
    html: shell({
      preheader: `${headline}. Booking ${deal.deal_ref}.`,
      heading: headline,
      body: `<p>Unfortunately, <strong>${esc(creator.name)}</strong> will not be moving forward with booking <strong>${esc(deal.deal_ref)}</strong>.</p>
      ${table([
        ['Booking reference', esc(deal.deal_ref)],
        ['Invoice', esc(invoice.invoice_no)],
        ['Creator', `${esc(creator.name)} (${esc(creator.handle)})`],
        ['Booking total', money(deal.total_usd)],
      ])}
      <p>${refundText}</p>
      <p>You can contact our team if you would like help choosing another creator.</p>`,
      cta: { label: 'View dashboard', url: `${config.site.url}/dashboard/bookings` },
    }),
  };
}

export function adminCreatorResponseEmail(
  deal: Deal,
  creator: Creator,
  response: 'accepted' | 'declined' | 'expired',
  refundOk?: boolean,
): Message {
  const label = response === 'accepted' ? 'accepted' : response === 'declined' ? 'declined' : 'timed out';
  return {
    to: config.email.adminEmail,
    template: 'admin_creator_response',
    subject: `[Booking] ${deal.deal_ref} — ${creator.name} ${label}`,
    html: shell({
      preheader: `Creator response for ${deal.deal_ref}: ${label}.`,
      heading: `Creator response: ${label}`,
      body: `<p><strong>${esc(creator.name)}</strong> ${label} booking <strong>${esc(deal.deal_ref)}</strong>.</p>
      ${table([
        ['Booking reference', esc(deal.deal_ref)],
        ['Brand', `${esc(deal.brand_name)} (${esc(deal.brand_email)})`],
        ['Creator', `${esc(creator.name)} (${esc(creator.contact_email)})`],
        ['Total', money(deal.total_usd)],
        ['Refund', response === 'accepted' ? 'Not required' : refundOk ? 'Completed' : 'Needs admin review'],
        ['Payout', response === 'accepted' ? 'Pending creator payout' : 'Not due'],
      ])}
      ${!refundOk && response !== 'accepted' ? '<p style="color:#C62828;font-weight:700;">Automatic refund failed. Please retry or process it in the payment provider dashboard.</p>' : ''}`,
      cta: { label: 'Open booking deals', url: `${config.site.url}/admin/deals` },
    }),
  };
}

export function adminNewBookingEmail(deal: Deal, creator: Creator): Message {
  return {
    to: config.email.adminEmail,
    template: 'admin_new_booking',
    subject: `[Booking] ${deal.deal_ref} — ${deal.brand_name} → ${creator.name} (${money(deal.total_usd)})`,
    html: shell({
      preheader: `New paid booking ${deal.deal_ref}.`,
      heading: 'New paid booking',
      body: table([
        ['Reference', esc(deal.deal_ref)],
        ['Brand', `${esc(deal.brand_name)} (${esc(deal.brand_email)})`],
        ['Creator', `${esc(creator.name)} — ${esc(creator.contact_email)}`],
        ['Contact verified', creator.contact_verified ? 'Yes' : '<span style="color:#E8541A;">No — verify before forwarding the brief</span>'],
        ['Deliverables', `${deal.quantity}x ${esc(deal.content_type)}`],
        ['Total', money(deal.total_usd)],
        ['Origin country', esc(deal.origin_country)],
      ]),
      cta: { label: 'Open in admin', url: `${config.site.url}/admin/deals` },
    }),
  };
}

// ---------------------------------------------------------------------------
// Requirement #2 — restricted-region lead
// ---------------------------------------------------------------------------
export function adminBookingRequestEmail(request: BookingRequest): Message {
  return {
    to: config.email.salesEmail,
    template: 'admin_booking_request',
    subject: `[Lead · ${request.country ?? '??'}] ${request.request_ref} — ${request.full_name}${request.creator_name ? ` wants ${request.creator_name}` : ''}`,
    html: shell({
      preheader: `Booking request from a restricted region: ${request.full_name}.`,
      heading: 'New booking request from a restricted region',
      body: `<p>A visitor could not check out online because of the regional payment restriction, and left their details instead.</p>
      ${table([
        ['Reference', esc(request.request_ref)],
        ['Name', esc(request.full_name)],
        ['Email', esc(request.email)],
        ['Phone', esc(request.phone)],
        ['Company', esc(request.company)],
        ['Website', esc(request.website)],
        ['Preferred contact', esc(request.preferred_contact)],
        ['Creator requested', esc(request.creator_name)],
        ['Content type', esc(request.content_type)],
        ['Quantity', esc(request.quantity)],
        ['Budget', esc(request.budget)],
        ['Country', esc(request.country)],
      ])}
      <p style="margin:0 0 6px;font-weight:700;">Message</p>
      <p style="margin:0;padding:12px 14px;background:#F8F8F8;border-left:3px solid #E8541A;white-space:pre-wrap;">${esc(request.message)}</p>`,
      cta: { label: 'Open in admin', url: `${config.site.url}/admin/booking-requests` },
    }),
  };
}

export function leadAcknowledgementEmail(request: BookingRequest): Message {
  return {
    to: request.email,
    template: 'lead_acknowledgement',
    subject: `We received your booking request (${request.request_ref})`,
    html: shell({
      preheader: 'Our account manager will contact you within one business day.',
      heading: 'Thank you — we have your request',
      body: `<p>Hi ${esc(request.full_name.split(' ')[0])},</p>
      <p>Self-serve checkout is not available in your region yet, so <strong>${esc(config.manager.name)}</strong> will set the booking up with you directly. We reply within one business day.</p>
      ${table([
        ['Your reference', esc(request.request_ref)],
        ['Creator requested', esc(request.creator_name)],
        ['Content type', esc(request.content_type)],
        ['Quantity', esc(request.quantity)],
        ['Budget', esc(request.budget)],
      ])}
      <p style="margin:0 0 6px;font-weight:700;">Reach us directly</p>
      ${table([
        ['Account manager', esc(config.manager.name)],
        ['Email', esc(config.manager.email)],
        ['Phone', esc(config.manager.phone)],
        ['WhatsApp / Zalo', esc(config.manager.whatsapp)],
        ['Office hours', esc(config.manager.hours)],
      ])}`,
      cta: { label: 'Browse creators', url: `${config.site.url}/marketplace` },
    }),
  };
}

// ---------------------------------------------------------------------------
// Applicants / partnership / contact
// ---------------------------------------------------------------------------
export function applicantReceivedEmail(applicant: Applicant): Message {
  const campaignApplication = Boolean(applicant.campaign_id);
  return {
    to: applicant.email,
    template: 'applicant_received',
    subject: campaignApplication
      ? 'Application received — BookingModel campaign'
      : 'Application received — BookingModel creator roster',
    html: shell({
      preheader: 'We received your creator application.',
      heading: 'Application received',
      body: `<p>Hi ${esc(applicant.name.split(' ')[0])}, thanks for applying${campaignApplication ? ' to a BookingModel campaign' : ' to the BookingModel creator roster'}.</p>
      <p>Our team reviews every profile manually — we are not an open sign-up platform. Expect a decision within 24 to 48 hours.</p>
      ${table([
        ['Name', esc(applicant.name)],
        ['Handle', esc(applicant.handle)],
        ['Platform', esc(applicant.platform)],
        ['Audience', esc(applicant.audience)],
        ['Niche', esc(applicant.niche)],
      ])}`,
    }),
  };
}

export function adminNewApplicantEmail(applicant: Applicant): Message {
  const campaignApplication = Boolean(applicant.campaign_id);
  return {
    to: config.email.adminEmail,
    template: 'admin_new_applicant',
    subject: `[${campaignApplication ? 'Campaign applicant' : 'Applicant'}] ${applicant.name} — ${applicant.platform} ${applicant.audience ?? ''}`,
    html: shell({
      preheader: 'New creator application awaiting review.',
      heading: 'New creator application',
      body: table([
        ['Name', esc(applicant.name)],
        ['Handle', esc(applicant.handle)],
        ['Platform', esc(applicant.platform)],
        ['Channel', esc(applicant.channel_url)],
        ['Audience', esc(applicant.audience)],
        ['ER', esc(applicant.er)],
        ['Rate', esc(applicant.rate)],
        ['Email', esc(applicant.email)],
        ['Country', esc(applicant.country)],
      ]),
      cta: {
        label: 'Review applicant',
        url: `${config.site.url}${campaignApplication ? '/admin/campaign-applicants' : '/admin/applicants'}`,
      },
    }),
  };
}

export function applicantDecisionEmail(applicant: Applicant, approved: boolean): Message {
  return {
    to: applicant.email,
    template: approved ? 'applicant_approved' : 'applicant_rejected',
    subject: approved
      ? 'Welcome to the BookingModel roster'
      : 'Update on your BookingModel application',
    html: approved
      ? shell({
          preheader: 'Your creator profile is live.',
          heading: 'You are on the roster',
          body: `<p>Hi ${esc(applicant.name.split(' ')[0])}, your profile is approved and now visible to brands on the BookingModel marketplace.</p>
          <p>When a brand books you, we email you the brief and the agreed rate. Nothing is published without your confirmation.</p>`,
          cta: { label: 'View the marketplace', url: `${config.site.url}/marketplace` },
        })
      : shell({
          preheader: 'Update on your application.',
          heading: 'Not a fit right now',
          body: `<p>Hi ${esc(applicant.name.split(' ')[0])}, thank you for applying. Your profile is not a match for the campaigns we are running at the moment.</p>
          <p>${esc(applicant.admin_notes ?? 'You are welcome to reapply in 3 months, especially once your engagement rate or niche focus has grown.')}</p>`,
        }),
  };
}

export function adminPartnershipEmail(request: PartnershipRequest): Message {
  return {
    to: config.email.salesEmail,
    template: 'admin_partnership',
    subject: `[Partnership] ${request.type ?? 'Inquiry'} — ${request.company ?? request.name ?? request.email}`,
    html: shell({
      preheader: 'New partnership request.',
      heading: 'New partnership request',
      body: table([
        ['Name', esc(request.name)],
        ['Company', esc(request.company)],
        ['Email', esc(request.email)],
        ['Phone', esc(request.phone)],
        ['Type', esc(request.type)],
        ['Budget', esc(request.budget)],
        ['Country', esc(request.country)],
        ['Message', esc(request.description)],
      ]),
      cta: { label: 'Open in admin', url: `${config.site.url}/admin/partnership` },
    }),
  };
}

export function brandWelcomeEmail(email: string, name: string | null): Message {
  return {
    to: email,
    template: 'brand_welcome',
    subject: 'Welcome to BookingModel',
    html: shell({
      preheader: 'Your brand account is ready.',
      heading: 'Your brand account is ready',
      body: `<p>Hi ${esc((name ?? 'there').split(' ')[0])}, welcome to BookingModel.</p>
      <p>You can browse the vetted creator roster right away. Upgrade to ${planName(lowestPlanWith('contact_reveals') ?? 'standard')} or above to unlock verified contact details, the brief builder and shortlists.</p>`,
      cta: { label: 'Go to your dashboard', url: `${config.site.url}/dashboard` },
    }),
  };
}

// ---------------------------------------------------------------------------
// Plan upgrades
// ---------------------------------------------------------------------------
export function adminUpgradeRequestEmail(request: UpgradeRequest): Message {
  return {
    to: config.email.salesEmail,
    template: 'admin_upgrade_request',
    subject: `Plan upgrade request — ${request.company_name ?? request.user_email} → ${planName(request.to_plan)}`,
    html: shell({
      preheader: `${request.user_email} wants the ${planName(request.to_plan)} plan.`,
      heading: 'A brand asked to upgrade',
      body: `<p>Review and apply the plan change from the internal dashboard.</p>
      ${table([
        ['Account', esc(request.company_name ?? request.user_email)],
        ['Email', esc(request.user_email)],
        ['Current plan', planName(request.from_plan)],
        ['Requested plan', planName(request.to_plan)],
        ['Route', request.source === 'sales' ? 'Sales-led (contact required)' : 'Self-serve (no card on file)'],
        ['Note', esc(request.note)],
      ])}`,
      cta: { label: 'Open upgrade requests', url: `${config.site.url}/admin/upgrade-requests` },
    }),
  };
}

export function brandUpgradeRequestedEmail(request: UpgradeRequest): Message {
  const target = planName(request.to_plan);
  return {
    to: request.user_email,
    template: 'brand_upgrade_requested',
    subject: `We received your ${target} plan request`,
    html: shell({
      preheader: `Your request to move to ${target} is with our team.`,
      heading: `Your ${target} plan request is in`,
      body: `<p>Thanks — the VEA team will confirm your ${esc(target)} plan and set up billing. We usually reply within one business day.</p>
      <p>Nothing has been charged yet, and your current ${planName(request.from_plan)} plan keeps working in the meantime.</p>`,
      cta: { label: 'View your plan', url: `${config.site.url}/dashboard/plan` },
    }),
  };
}

export function brandPlanChangedEmail(
  to: string,
  fromPlan: Plan,
  toPlan: Plan,
): Message {
  const definition = PLANS[toPlan];
  const reveals = definition.dailyReveals === Number.POSITIVE_INFINITY
    ? 'Unlimited'
    : `${definition.dailyReveals} per day`;

  return {
    to,
    template: 'brand_plan_changed',
    subject: `You are now on the ${definition.name} plan`,
    html: shell({
      preheader: `${planName(fromPlan)} → ${definition.name}.`,
      heading: `Welcome to ${definition.name}`,
      body: `<p>${esc(definition.summary)}</p>
      ${table([
        ['Previous plan', planName(fromPlan)],
        ['New plan', definition.name],
        ['Contact reveals', reveals],
        ['Platform fee on bookings', `${definition.feePercent}%`],
      ])}`,
      cta: { label: 'Go to your dashboard', url: `${config.site.url}/dashboard` },
    }),
  };
}
