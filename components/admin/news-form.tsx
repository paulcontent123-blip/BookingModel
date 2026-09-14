'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { NEWS_CATEGORIES } from '@/lib/content';
import { buildToc, groupToc, parseDoc, type TocEntry } from '@/lib/content-doc';
import { CoverPicker, uploadCover, validateCoverFile } from '@/components/admin/cover-picker';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import type { ActionResult } from '@/lib/services/admin-actions';
import type { NewsPost } from '@/lib/types';

/** Local date value for <input type="date">, in UTC to match the stored date. */
function dateValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function TocPreview({ entries, enabled }: { entries: TocEntry[]; enabled: boolean }) {
  const sections = groupToc(entries);

  return (
    <div className={`news-toc-preview${enabled ? '' : ' is-disabled'}`} aria-live="polite">
      <div className="news-toc-preview-title">
        Table of contents preview{enabled ? '' : ' — hidden on the public article'}
      </div>
      {sections.length === 0 ? (
        <div className="news-toc-preview-empty">Select text and apply H2 or H3 to add an item.</div>
      ) : (
        <ol className="news-toc-preview-list">
          {sections.map((section, index) => {
            if (!section.parent) {
              return (
                <li key={`orphan-${index}`} className="is-orphan">
                  <ul>
                    {section.children.map((entry) => <li key={entry.id}>{entry.text}</li>)}
                  </ul>
                </li>
              );
            }

            return (
              <li key={section.parent.id}>
                <span><b>{section.parent.number}.</b> {section.parent.text}</span>
                {section.children.length > 0 && (
                  <ul>{section.children.map((entry) => <li key={entry.id}>{entry.text}</li>)}</ul>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export function NewsForm({
  post,
  action,
  submitLabel,
}: {
  post?: NewsPost;
  action: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [tocEntries, setTocEntries] = useState(() => buildToc(parseDoc(post?.body)));
  const [showToc, setShowToc] = useState(post?.show_toc !== false);

  return (
    <form
      className="card"
      style={{ maxWidth: 780 }}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        if (coverFile) {
          const error = validateCoverFile(coverFile);
          if (error) {
            setResult({ ok: false, message: error });
            return;
          }
        }

        const typedUrl = String(formData.get('cover_url') ?? '').trim();
        const shouldUpload = Boolean(coverFile) || (!!typedUrl && typedUrl !== (post?.cover_url ?? ''));

        startTransition(async () => {
          try {
            if (shouldUpload) {
              setUploading(true);
              formData.set('cover_url', await uploadCover(coverFile ?? typedUrl));
            }
            formData.delete('cover_file');

            const res = await action(formData);
            setResult(res);
            if (res.ok) {
              if (post) router.refresh();
              else router.push('/admin/news');
            }
          } catch (error) {
            setResult({
              ok: false,
              message: error instanceof Error ? error.message : 'The cover could not be uploaded.',
            });
          } finally {
            setUploading(false);
          }
        });
      }}
    >
      {result && (
        <div
          className={`alert ${result.ok ? 'alert-ok' : 'alert-error'}`}
          role={result.ok ? 'status' : 'alert'}
          aria-live="polite"
        >
          {result.message}
        </div>
      )}

      <div className="card-title">Article</div>

      <div className="fg">
        <label htmlFor="title">Title *</label>
        <input
          id="title"
          name="title"
          required
          maxLength={180}
          defaultValue={post?.title}
          placeholder="How NoodleCo achieved 3.4x ROAS on TikTok Shop"
        />
      </div>

      <div className="fg-row">
        <div className="fg">
          <label htmlFor="category">Category *</label>
          <select id="category" name="category" defaultValue={post?.category ?? NEWS_CATEGORIES[0]}>
            {NEWS_CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
        <div className="fg">
          <label htmlFor="author">Author</label>
          <input
            id="author"
            name="author"
            defaultValue={post?.author ?? ''}
            placeholder="BookingModel Editorial"
          />
        </div>
      </div>

      <div className="fg-row">
        <div className="fg">
          <label htmlFor="slug">URL slug</label>
          <input
            id="slug"
            name="slug"
            defaultValue={post?.slug ?? ''}
            placeholder="Leave empty to build it from the title"
          />
          <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
            Public address: /news/{post?.slug ?? '…'}
          </span>
        </div>
        <div className="fg">
          <label htmlFor="published_at">Publish date</label>
          <input
            id="published_at"
            name="published_at"
            type="date"
            defaultValue={dateValue(post?.published_at ?? null)}
          />
          <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
            Controls the order on /news. Empty means today when it first goes live.
          </span>
        </div>
      </div>

      <div className="fg">
        <label htmlFor="excerpt">Summary</label>
        <textarea
          id="excerpt"
          name="excerpt"
          rows={3}
          defaultValue={post?.excerpt ?? ''}
          placeholder="Shown on the cards and as the lead paragraph of the article."
        />
      </div>

      <div className="fg">
        <label htmlFor="body">Body *</label>
        <RichTextEditor
          name="body"
          initialBody={post?.body}
          onTocChange={(entries) => {
            setTocEntries(entries);
            // An earlier failed submit may have complained about an empty
            // body. Clear that stale message as soon as the editor changes.
            if (result) setResult(null);
          }}
        />
        <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
          H1/H2/H3 apply to the selected text only. Clear removes every format from the selected text.
        </span>
      </div>

      <label className="news-toc-toggle">
        <input
          type="checkbox"
          name="show_toc"
          checked={showToc}
          onChange={(event) => setShowToc(event.target.checked)}
        />
        <span>
          <strong>Show table of contents at the top of the article</strong>
          <small>H2 is numbered continuously; H3 appears as bullet points under the preceding H2.</small>
        </span>
      </label>

      <TocPreview entries={tocEntries} enabled={showToc} />

      <div className="card-title" style={{ marginTop: 8 }}>Cover image</div>

      <CoverPicker
        currentUrl={post?.cover_url ?? null}
        onFileChange={setCoverFile}
        hint="Landscape works best — it fills the card and the article header."
      />

      <div className="fg-row">
        <div className="fg">
          <label htmlFor="emoji">Fallback emoji</label>
          <input id="emoji" name="emoji" maxLength={4} defaultValue={post?.emoji ?? '📰'} />
          <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
            Used on the card when there is no cover image.
          </span>
        </div>
        <div className="fg">
          <label htmlFor="accent_bg">Card tint</label>
          <input
            id="accent_bg"
            name="accent_bg"
            defaultValue={post?.accent_bg ?? ''}
            placeholder="#EEF2EE"
          />
        </div>
      </div>

      <div className="card-title" style={{ marginTop: 8 }}>Search engines</div>

      <div className="fg">
        <label htmlFor="seo_title">SEO title</label>
        <input
          id="seo_title"
          name="seo_title"
          defaultValue={post?.seo_title ?? ''}
          placeholder="Defaults to the article title"
        />
      </div>

      <div className="fg">
        <label htmlFor="seo_description">Meta description</label>
        <textarea
          id="seo_description"
          name="seo_description"
          rows={2}
          defaultValue={post?.seo_description ?? ''}
          placeholder="Defaults to the summary. Around 155 characters works best."
        />
      </div>

      <div className="card-title" style={{ marginTop: 8 }}>Publishing</div>

      <div className="fg">
        <label htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={post?.status ?? 'draft'}>
          <option value="draft">Draft — only visible here</option>
          <option value="published">Published — live on the public site</option>
        </select>
      </div>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 14 }}>
        <input type="checkbox" name="featured" defaultChecked={post?.featured ?? false} />
        Pin this article first in the /news card list
      </label>

      <div className="row gap-6">
        <button className="btn btn-primary" type="submit" disabled={pending || uploading}>
          {uploading ? 'Uploading cover…' : pending ? 'Saving…' : submitLabel}
        </button>
        <Link href="/admin/news" className="btn btn-ghost">Cancel</Link>
        {post?.status === 'published' && (
          <Link href={`/news/${post.slug}`} target="_blank" className="btn btn-ghost">
            View on site ↗
          </Link>
        )}
      </div>
    </form>
  );
}
