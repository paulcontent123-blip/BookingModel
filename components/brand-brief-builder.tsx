'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { BrandActionResult } from '@/lib/services/brand-actions';

export interface BrandBriefMatch {
  id: string;
  name: string;
  handle: string;
  platform: string;
  category: string | null;
  audience: string | null;
  audienceCount: number | null;
  er: string | null;
  erValue: number | null;
}

interface BriefValues {
  title: string;
  category: string;
  contentType: string;
  platform: string;
  videoLength: string;
  spots: string;
  budget: string;
  minFollowers: string;
  minEngagement: string;
  preferredPlatform: string;
  brief: string;
  talkingPoints: string;
}

const initialValues = (categories: string[], contentTypes: string[]): BriefValues => ({
  title: '',
  category: categories[0] ?? '',
  contentType: contentTypes[0] ?? '',
  platform: 'TikTok',
  videoLength: '15-30 sec',
  spots: '5',
  budget: '',
  minFollowers: '',
  minEngagement: '',
  preferredPlatform: '',
  brief: '',
  talkingPoints: '',
});

function followerThreshold(value: string): number {
  const match = value.match(/([\d.]+)\s*([KM]?)/i);
  if (!match) return 0;
  const amount = Number(match[1]);
  const suffix = match[2]?.toUpperCase();
  return Math.round(amount * (suffix === 'M' ? 1_000_000 : suffix === 'K' ? 1_000 : 1));
}

function engagementThreshold(value: string): number {
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) ? amount : 0;
}

export function BrandBriefBuilder({
  action,
  categories,
  contentTypes,
  creators,
}: {
  action: (formData: FormData) => Promise<BrandActionResult>;
  categories: string[];
  contentTypes: string[];
  creators: BrandBriefMatch[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<BriefValues>(() => initialValues(categories, contentTypes));
  const [requestedMode, setRequestedMode] = useState<'submit' | 'draft'>('draft');
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<BrandActionResult | null>(null);

  const matches = useMemo(() => {
    const minFollowers = followerThreshold(values.minFollowers);
    const minEngagement = engagementThreshold(values.minEngagement);
    const preferred = values.preferredPlatform.replace(/\s+only$/i, '').trim().toLowerCase();

    return creators
      .filter((creator) => {
        if (preferred && !creator.platform.toLowerCase().includes(preferred)) return false;
        if (minFollowers && (creator.audienceCount ?? 0) < minFollowers) return false;
        if (minEngagement && (creator.erValue ?? 0) < minEngagement) return false;
        return true;
      })
      .slice(0, 4);
  }, [creators, values.minEngagement, values.minFollowers, values.preferredPlatform]);

  function setField<K extends keyof BriefValues>(field: K, value: BriefValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setValues(initialValues(categories, contentTypes));
    setRequestedMode('draft');
  }

  return (
    <div className="brand-brief-grid">
      <form
        className="brand-brief-form"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          const mode = submitter?.value === 'submit' ? 'submit' : 'draft';
          setRequestedMode(mode);
          formData.set('mode', mode);
          startTransition(async () => {
            const response = await action(formData);
            setResult(response);
            if (response.ok) {
              if (mode === 'submit') resetForm();
              router.refresh();
            }
          });
        }}
      >
        {result && (
          <div className={`brand-dashboard-alert ${result.ok ? 'success' : 'error'}`} role="status">
            {result.message}
          </div>
        )}

        <section className="brand-brief-card">
          <h2>Campaign Details</h2>
          <div className="brand-brief-field">
            <label htmlFor="brand-brief-title">Campaign name *</label>
            <input
              id="brand-brief-title"
              name="title"
              value={values.title}
              onChange={(event) => setField('title', event.target.value)}
              placeholder="e.g. Summer Skincare UGC Q3"
              required
            />
          </div>

          <div className="brand-brief-field-grid">
            <div className="brand-brief-field">
              <label htmlFor="brand-brief-category">Category *</label>
              <select
                id="brand-brief-category"
                name="category"
                value={values.category}
                onChange={(event) => setField('category', event.target.value)}
                required
              >
                {categories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </div>
            <div className="brand-brief-field">
              <label htmlFor="brand-brief-content-type">Content type *</label>
              <select
                id="brand-brief-content-type"
                name="content_type"
                value={values.contentType}
                onChange={(event) => setField('contentType', event.target.value)}
                required
              >
                {contentTypes.map((contentType) => <option key={contentType}>{contentType}</option>)}
              </select>
            </div>
          </div>

          <div className="brand-brief-field-grid">
            <div className="brand-brief-field">
              <label htmlFor="brand-brief-platform">Platform *</label>
              <select
                id="brand-brief-platform"
                name="platform"
                value={values.platform}
                onChange={(event) => setField('platform', event.target.value)}
                required
              >
                {['TikTok', 'Instagram Reels', 'YouTube Shorts', 'TikTok + Meta', 'All platforms'].map((platform) => (
                  <option key={platform}>{platform}</option>
                ))}
              </select>
            </div>
            <div className="brand-brief-field">
              <label htmlFor="brand-brief-length">Video length</label>
              <select
                id="brand-brief-length"
                name="video_length"
                value={values.videoLength}
                onChange={(event) => setField('videoLength', event.target.value)}
              >
                {['15-30 sec', '30-60 sec', '60-90 sec', '2-5 min'].map((length) => (
                  <option key={length}>{length}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="brand-brief-field-grid">
            <div className="brand-brief-field">
              <label htmlFor="brand-brief-spots">Creator spots</label>
              <input
                id="brand-brief-spots"
                name="spots_total"
                type="number"
                min={1}
                max={200}
                value={values.spots}
                onChange={(event) => setField('spots', event.target.value)}
              />
            </div>
            <div className="brand-brief-field">
              <label htmlFor="brand-brief-budget">Budget per creator (USD)</label>
              <input
                id="brand-brief-budget"
                name="budget_per_creator"
                type="number"
                min={0}
                step="1"
                value={values.budget}
                onChange={(event) => setField('budget', event.target.value)}
                placeholder="e.g. 200"
              />
            </div>
          </div>
        </section>

        <section className="brand-brief-card">
          <h2>Creator Requirements</h2>
          <div className="brand-brief-field">
            <label htmlFor="brand-brief-followers">Min. followers</label>
            <select
              id="brand-brief-followers"
              name="min_followers"
              value={values.minFollowers}
              onChange={(event) => setField('minFollowers', event.target.value)}
            >
              <option value="">Any</option>
              {['10K+', '50K+', '100K+', '500K+'].map((value) => <option key={value}>{value}</option>)}
            </select>
          </div>
          <div className="brand-brief-field">
            <label htmlFor="brand-brief-engagement">Min. engagement rate</label>
            <select
              id="brand-brief-engagement"
              name="min_engagement"
              value={values.minEngagement}
              onChange={(event) => setField('minEngagement', event.target.value)}
            >
              <option value="">Any</option>
              {['5%+', '7%+', '10%+'].map((value) => <option key={value}>{value}</option>)}
            </select>
          </div>
          <div className="brand-brief-field">
            <label htmlFor="brand-brief-preferred-platform">Preferred platforms</label>
            <select
              id="brand-brief-preferred-platform"
              name="preferred_platform"
              value={values.preferredPlatform}
              onChange={(event) => setField('preferredPlatform', event.target.value)}
            >
              <option value="">No preference</option>
              {['TikTok only', 'YouTube only', 'Instagram only'].map((value) => <option key={value}>{value}</option>)}
            </select>
          </div>
        </section>

        <section className="brand-brief-card">
          <h2>Brief / Instructions</h2>
          <div className="brand-brief-field">
            <label htmlFor="brand-brief-instructions">Campaign brief {requestedMode === 'submit' ? '*' : ''}</label>
            <textarea
              id="brand-brief-instructions"
              name="brief_text"
              rows={5}
              value={values.brief}
              onChange={(event) => setField('brief', event.target.value)}
              placeholder="Describe what the content should cover, key messages, do's and don'ts, brand voice..."
            />
          </div>
          <div className="brand-brief-field">
            <label htmlFor="brand-brief-points">Key talking points (one per line)</label>
            <textarea
              id="brand-brief-points"
              name="talking_points"
              rows={3}
              value={values.talkingPoints}
              onChange={(event) => setField('talkingPoints', event.target.value)}
              placeholder={'- Highlight the new SPF formula\n- Mention the scent-free formula\n- Include promo code SUMMER20'}
            />
          </div>
          <div className="brand-brief-actions">
            <button
              className="brand-brief-primary"
              type="submit"
              value="submit"
              disabled={pending}
              onClick={() => setRequestedMode('submit')}
            >
              {pending && requestedMode === 'submit' ? 'Submitting…' : 'Submit Campaign Brief →'}
            </button>
            <button
              className="brand-brief-secondary"
              type="submit"
              value="draft"
              disabled={pending}
              onClick={() => setRequestedMode('draft')}
            >
              {pending && requestedMode === 'draft' ? 'Saving…' : 'Save Draft'}
            </button>
          </div>
        </section>
      </form>

      <aside className="brand-brief-sidebar">
        <div className="brand-brief-preview">
          <div className="brand-brief-preview-label">Brief Preview</div>
          <div className="brand-brief-preview-title">
            {values.title || 'Your campaign name'}
          </div>
          <div className="brand-brief-preview-copy">
            {[values.category, values.contentType, values.platform].filter(Boolean).join(' · ') || 'Fill in the form to preview your brief.'}
          </div>
          <div className="brand-brief-preview-copy">
            {values.spots || '0'} creator spots
            {values.budget ? ` · $${values.budget}/creator` : ''}
            {values.videoLength ? ` · ${values.videoLength}` : ''}
          </div>
          {values.brief && <p className="brand-brief-preview-text">{values.brief}</p>}
        </div>

        <div className="brand-brief-matches">
          <h2>Matching Creators</h2>
          {matches.length === 0 ? (
            <p>Complete the requirements to see creator matches.</p>
          ) : (
            <div className="brand-brief-match-list">
              {matches.map((creator) => (
                <div className="brand-brief-match" key={creator.id}>
                  <div>
                    <strong>{creator.name}</strong>
                    <span>{creator.handle} · {creator.platform}</span>
                  </div>
                  <small>{creator.audience ?? '—'} · {creator.er ?? '—'} ER</small>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
