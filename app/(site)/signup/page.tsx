import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { SignupForm } from '@/components/auth-form';

export const metadata: Metadata = { title: 'Create a brand account' };

export default async function SignupPage() {
  const user = await getSessionUser();
  if (user) redirect('/dashboard');

  return (
    <section className="sec" style={{ maxWidth: 520 }}>
      <div className="sec-eye">Brands &amp; agencies</div>
      <h1 className="sec-h">Create your <strong>brand account</strong></h1>
      <p className="sec-p">
        Free to start — browse the full vetted roster. Upgrade when you need verified contact
        details and campaign tracking.
      </p>

      <SignupForm />

      <p style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 14, lineHeight: 1.7 }}>
        Are you a creator? Apply to the roster instead — brands find you, and we handle the
        contracting and payment.
      </p>
    </section>
  );
}
