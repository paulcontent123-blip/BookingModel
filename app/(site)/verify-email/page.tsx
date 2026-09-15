import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { EmailVerificationForm } from '@/components/email-verification-form';
import { getSessionUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Verify your email' };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const [{ email }, user] = await Promise.all([searchParams, getSessionUser()]);
  if (user) redirect('/dashboard');

  const initialEmail = email?.trim().toLowerCase() ?? '';
  return (
    <section className="sec" style={{ maxWidth: 520 }}>
      <div className="sec-eye">Email verification</div>
      <h1 className="sec-h">Verify your <strong>email</strong></h1>
      <p className="sec-p">
        We sent a 6-digit code to your email. Enter it below to finish setting up your brand
        account.
      </p>

      <EmailVerificationForm initialEmail={initialEmail} />
    </section>
  );
}
