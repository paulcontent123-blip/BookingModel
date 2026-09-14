import Link from 'next/link';
import { NewsForm } from '@/components/admin/news-form';
import { createNewsPostAction } from '@/lib/services/content-actions';

export const metadata = { title: 'New Article' };

export default function NewNewsPostPage() {
  return (
    <>
      <h1 className="pg-title">New article</h1>
      <p className="pg-sub">
        Save it as a draft while you write. Publishing pushes it to{' '}
        <Link href="/news" target="_blank">/news</Link> and the homepage immediately.
      </p>

      <NewsForm action={createNewsPostAction} submitLabel="Create article" />
    </>
  );
}
