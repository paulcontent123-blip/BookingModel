const TONE: Record<string, string> = {
  // deal status
  pending_payment: 'amber',
  negotiating: 'gray',
  brief_sent: 'blue',
  content_in_review: 'amber',
  approved: 'green',
  published: 'green',
  completed: 'green',
  overdue: 'red',
  cancelled: 'red',
  // payment status
  unpaid: 'amber',
  paid: 'green',
  refunded: 'gray',
  failed: 'red',
  // creator response / refund / payout
  accepted: 'green',
  declined: 'red',
  expired: 'red',
  not_required: 'gray',
  not_due: 'gray',
  processing: 'amber',
  payout_pending: 'amber',
  // applicant / request status
  pending: 'amber',
  rejected: 'red',
  new: 'blue',
  contacted: 'amber',
  quoted: 'blue',
  converted: 'green',
  closed: 'gray',
  in_discussion: 'amber',
  in_progress: 'amber',
  // creator status
  active: 'green',
  inactive: 'gray',
  // email log
  sent: 'green',
  logged: 'blue',
  // plans
  free: 'gray',
  standard: 'blue',
  pro: 'green',
  enterprise: 'amber',
  draft: 'gray',
  void: 'gray',
};

/** Renders a `.badge` in the admin design system. Use inside `.bm-admin`. */
export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="badge badge-gray">—</span>;
  const tone = TONE[status] ?? 'gray';
  return <span className={`badge badge-${tone}`}>{status.replace(/_/g, ' ')}</span>;
}
