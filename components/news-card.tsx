import Link from 'next/link';
import { formatPublishDate, newsCardBg } from '@/lib/content';
import type { NewsPost } from '@/lib/types';

/** The cover image when one was uploaded, otherwise the article emoji tile. */
function Cover({ src, emoji, alt }: { src: string | null; emoji: string | null; alt: string }) {
  if (src) return <img className="news-cover" src={src} alt={alt} loading="lazy" />;
  return <>{emoji ?? '📰'}</>;
}

/** The uniform article card shared by the homepage and the News index. */
export function NewsCard({ post }: { post: NewsPost }) {
  return (
    <Link href={`/news/${post.slug}`} className="nl-card">
      <div className="nl-img" style={{ background: newsCardBg(post) }}>
        <Cover src={post.cover_url} emoji={post.emoji} alt={post.title} />
      </div>
      <div className="nl-body">
        <div className="ns-cat">{post.category}</div>
        <h2 className="nl-title">{post.title}</h2>
        {post.excerpt && <p className="nl-excerpt">{post.excerpt}</p>}
        <div className="nl-footer">
          <div className="ns-date">{formatPublishDate(post.published_at ?? post.created_at)}</div>
          <span className="nl-read">Read story →</span>
        </div>
      </div>
    </Link>
  );
}
