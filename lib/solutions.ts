export interface Solution {
  slug: string;
  icon: string;
  title: string;
  headline: string;
  tagline: string;
  intro: string;
  cardDesc: string;
  steps: { title: string; body: string }[];
  includes: { icon: string; title: string; body: string }[];
  cta: string;
}

/** Copy ported from Document/bookingmodel_public_v3_final.html */
export const SOLUTIONS: Solution[] = [
  {
    slug: 'ugc',
    icon: '🎬',
    title: 'On-Demand UGC & AI Creation',
    headline: 'On-Demand UGC and AI Creation',
    tagline: 'Authentic content at production scale',
    cardDesc:
      'Authentic video content from vetted creators. UGC, testimonials, unboxing, b-roll. AI-assisted pipeline for scale.',
    intro:
      'We match your brand with vetted UGC creators who know how to make content that converts. Every video is delivered formatted for your platform, with full commercial usage rights and unlimited revisions until you approve.',
    steps: [
      { title: 'Brief your campaign', body: 'Describe your product, key message, tone and any hooks or CTAs. Our AI brief writer helps you get it right in under 5 minutes.' },
      { title: 'Creators apply to you', body: 'Within 24 hours, creators aligned with your niche apply to your campaign. You review their past work and pick who to work with.' },
      { title: 'Content delivered in 7 days', body: 'Creators produce and deliver. You review and request unlimited revisions. Once approved, download with full commercial rights.' },
      { title: 'Go live and scale', body: 'Run the content as-is on TikTok, Meta, Instagram or YouTube. Need more? Reorder from the same creator or launch a new batch.' },
    ],
    includes: [
      { icon: '🎬', title: 'Ready-to-run ad creatives', body: 'Delivered formatted for TikTok Spark Ads, Meta Feed, Reels and YouTube Shorts. Aspect ratio conversion included.' },
      { icon: '🔄', title: 'Unlimited revisions', body: 'We iterate until you are 100% satisfied. Average approval happens in round 1 or 2 for 91% of campaigns.' },
      { icon: '⚖️', title: 'Full usage rights', body: 'Run the content as paid ads on any platform with no hidden licensing fees, time limits or territory restrictions.' },
      { icon: '🤖', title: 'AI-assisted post-production', body: 'Auto subtitles in 65+ languages, format conversion, brand color overlay and template application.' },
      { icon: '📦', title: 'All content types covered', body: 'Testimonial, unboxing, talking head, b-roll, recipe, before-and-after, product demo and more.' },
      { icon: '🚀', title: 'From $59 per video', body: 'Micro-creator rates start at $59 per 30-second video. Premium and top-creator tiers available for higher production value.' },
    ],
    cta: 'Request UGC Campaign',
  },
  {
    slug: 'influencer',
    icon: '🤝',
    title: 'Influencer Marketing',
    headline: 'Influencer Marketing',
    tagline: 'End-to-end campaign management',
    cardDesc:
      'End-to-end booking and campaign management. Creative strategist, IMC planning, invite and manage creators.',
    intro:
      'From creator discovery to final reporting, our team manages every step of your influencer campaign. You brief us on your goals, and we handle the rest — finding the right creators, negotiating rates, managing content and delivering a full performance report.',
    steps: [
      { title: 'Campaign strategy', body: 'We align on campaign goals, target audience, platforms and KPIs. Our creative strategist develops the content direction, hooks and brief.' },
      { title: 'Creator discovery and outreach', body: 'We search our database of 140,000+ creators and manually curate a shortlist that fits your brand. We reach out, negotiate rates and handle contracts.' },
      { title: 'Content management', body: 'Creators produce content to brief. We review every piece before it reaches you. Revisions are managed on your behalf.' },
      { title: 'Reporting and optimization', body: 'Post-campaign we deliver a full performance report with views, engagement, reach, CPM and learnings for the next campaign.' },
    ],
    includes: [
      { icon: '🔄', title: 'End-to-End Booking', body: 'Discovery, outreach, negotiation, contracting and payment — fully handled by our team.' },
      { icon: '📩', title: 'Invite and Manage', body: 'Bring your existing creator relationships into our platform for seamless brief delivery and tracking.' },
      { icon: '🧠', title: 'Creative Strategist', body: 'Hooks, scripts, briefs and content direction developed by our in-house creative team.' },
      { icon: '📋', title: 'IMC Campaign Planning', body: 'Integrated marketing communication across TikTok, Meta, YouTube and email in one coordinated plan.' },
      { icon: '⚖️', title: 'Contract and Rights', body: 'We handle usage rights agreements, disclosure compliance and payment terms on your behalf.' },
      { icon: '📈', title: 'Performance Analytics', body: 'Full post-campaign report with creator-level breakdown, content performance and ROI attribution.' },
    ],
    cta: 'Request Influencer Campaign',
  },
  {
    slug: 'ecommerce',
    icon: '🛒',
    title: 'E-Commerce Service',
    headline: 'E-Commerce Service',
    tagline: 'Full platform operation',
    cardDesc:
      'Full operation for TikTok Shop, Amazon, Etsy and Shopify. Store setup, listings, ads, logistics coordination.',
    intro:
      'We operate your e-commerce channels end-to-end — from initial store setup to daily management, advertising and performance optimization. Whether you are launching on TikTok Shop, scaling on Amazon, or building on Shopify, our team handles operations so you can focus on the brand.',
    steps: [
      { title: 'Store setup and onboarding', body: 'We set up your store, configure products, write SEO-optimized listings and connect payment and logistics integrations.' },
      { title: 'Content and creative production', body: 'We produce or source product photography, A+ content, video ads and social content aligned with platform best practices.' },
      { title: 'Advertising and promotion', body: 'We manage platform-native advertising — TikTok Shop Ads, Amazon PPC, Meta retargeting and affiliate recruitment for TikTok Shop.' },
      { title: 'Ongoing management and reporting', body: 'Daily operations, inventory coordination, customer review management and monthly performance reporting with clear KPIs.' },
    ],
    includes: [
      { icon: '🛍', title: 'TikTok Shop', body: 'Store setup, affiliate creator recruitment, live shopping coordination, listing optimization and order operations.' },
      { icon: '📦', title: 'Amazon Operation', body: 'Seller Central management, listing SEO, A+ content creation, PPC advertising management and review strategy.' },
      { icon: '🏪', title: 'Shopify and Etsy', body: 'Store design and build, product listing, photography direction, SEO, conversion rate optimization and paid traffic.' },
      { icon: '📢', title: 'Platform Advertising', body: 'Managed ad campaigns across TikTok Shop Ads, Amazon Sponsored, Meta and Google Shopping.' },
      { icon: '🤝', title: 'Affiliate Recruitment', body: 'We recruit and manage TikTok Shop affiliates — creators who promote your products on commission.' },
      { icon: '📊', title: 'Monthly Reporting', body: 'Revenue tracking, conversion analysis, ad performance breakdown and growth recommendations every month.' },
    ],
    cta: 'Discuss Your Store',
  },
  {
    slug: 'advertising',
    icon: '📢',
    title: 'Advertising Spend',
    headline: 'Advertising Spend Management',
    tagline: 'Performance ads that convert',
    cardDesc:
      'Performance ad campaigns through TikTok Ads and Meta Ads. Creative, targeting, A/B testing, reporting.',
    intro:
      'We manage your paid social advertising on TikTok and Meta from creative to reporting. Our team combines UGC creative production with performance media buying to maximize ROAS and minimize wasted spend.',
    steps: [
      { title: 'Creative development', body: 'We produce or source high-converting UGC ad creatives — hooks, testimonials, product demos — formatted for each placement.' },
      { title: 'Campaign setup and targeting', body: 'We build out your campaign structure, audience targeting, lookalikes and retargeting funnels on TikTok Ads and Meta Ads.' },
      { title: 'Launch and A/B testing', body: 'We launch with multiple creative variants and rapidly identify winning ads using systematic A/B testing protocols.' },
      { title: 'Optimization and reporting', body: 'Weekly bid adjustments, budget reallocation and creative refreshes based on performance data. Monthly report with clear ROAS and CPA.' },
    ],
    includes: [
      { icon: '📱', title: 'TikTok Ads', body: 'In-Feed Ads, Spark Ads, TopView, TikTok Shop Ads and Brand Takeover managed end-to-end.' },
      { icon: '💻', title: 'Meta Ads', body: 'Facebook and Instagram ad campaigns — Advantage+, retargeting, Partnership Ads and catalog campaigns.' },
      { icon: '🎬', title: 'UGC Creative for Ads', body: 'We produce or source ad-ready UGC specifically optimized for paid social — hooks, captions, formats.' },
      { icon: '🎯', title: 'Audience Targeting', body: 'Custom audiences, lookalikes, interest targeting and retargeting funnels built from your first-party data.' },
      { icon: '🔬', title: 'A/B Testing Protocol', body: 'Systematic creative and audience testing to identify winning combinations before scaling spend.' },
      { icon: '📊', title: 'Weekly Reporting', body: 'Clear KPIs every week — ROAS, CPA, CTR, CPM and spend efficiency with actionable recommendations.' },
    ],
    cta: 'Get Started with Ads',
  },
  {
    slug: 'production',
    icon: '🎥',
    title: 'Production & Livestream',
    headline: 'Production and Livestream',
    tagline: 'Studio quality content',
    cardDesc:
      'Studio and on-location production for brand videos, livestream commerce, and event content.',
    intro:
      'Beyond UGC, we produce studio-quality brand content for launches, campaigns, events and livestream commerce. Our team coordinates everything — location scouting, crew, talent, direction, post-production and delivery.',
    steps: [
      { title: 'Creative brief and pre-production', body: 'We develop the creative concept, shot list, talent brief and production schedule aligned with your campaign goals.' },
      { title: 'Studio or on-location shoot', body: 'Our crew handles studio or location-based production — lighting, sound, direction, talent management and on-set logistics.' },
      { title: 'Livestream setup and hosting', body: 'For TikTok Shop or platform livestreams, we set up the technical infrastructure, host or co-host and manage the live session.' },
      { title: 'Post-production and delivery', body: 'Professional editing, color grading, subtitles, format conversion and delivery in all required resolutions and aspect ratios.' },
    ],
    includes: [
      { icon: '🎥', title: 'Brand Video Production', body: 'Product films, brand story videos, campaign hero assets and TV-quality commercials.' },
      { icon: '📡', title: 'Livestream Commerce', body: 'TikTok Live and platform livestream setup, hosting, product showcasing and order management.' },
      { icon: '🎪', title: 'Event Content', body: 'Trade show coverage, product launch events, activation filming and same-day turnaround delivery.' },
      { icon: '✂️', title: 'Post-Production', body: 'Color grading, motion graphics, caption overlays, format conversion and multi-platform delivery.' },
      { icon: '👤', title: 'Talent Sourcing', body: 'We source and book on-camera talent, presenters, hosts and actors for production projects.' },
      { icon: '🌍', title: 'Location and Studio', body: 'Studio access and location scouting across major US markets — New York, Los Angeles, Miami and more.' },
    ],
    cta: 'Request Production Quote',
  },
  {
    slug: 'brand',
    icon: '🎯',
    title: 'Brand Identity & SEO',
    headline: 'Brand Identity and SEO',
    tagline: 'Build a brand that lasts',
    cardDesc:
      'Brand strategy, visual identity, content calendar, SEO and website optimization. Long-term growth.',
    intro:
      'Before you scale with creators and ads, the brand needs to be right. We build brand strategy, visual identity, website copy and technical SEO foundations that support sustainable long-term growth for DTC brands.',
    steps: [
      { title: 'Brand strategy and positioning', body: 'We define your brand voice, positioning, target customer profile and competitive differentiation — the foundation everything else is built on.' },
      { title: 'Visual identity design', body: 'Logo, color palette, typography, packaging guidelines and social media templates aligned with your positioning.' },
      { title: 'Website and copy', body: 'Homepage copy, product descriptions, email sequences and content strategy written for both conversion and SEO.' },
      { title: 'Technical SEO', body: 'Site audit, keyword strategy, on-page optimization, page speed improvements and ongoing content calendar to drive organic traffic.' },
    ],
    includes: [
      { icon: '🎨', title: 'Visual Identity', body: 'Logo, color system, typography, brand guidelines and asset library for consistent use across all channels.' },
      { icon: '✍️', title: 'Brand Copywriting', body: 'Website copy, product descriptions, ad copy, email sequences and social media content in your brand voice.' },
      { icon: '🔍', title: 'SEO Strategy', body: 'Keyword research, content calendar, on-page optimization and technical SEO audit with monthly tracking.' },
      { icon: '📱', title: 'Social Media Setup', body: 'Profile optimization, content templates, bio copy and launch content calendar for TikTok, Instagram and more.' },
      { icon: '📧', title: 'Email Marketing', body: 'Klaviyo or Mailchimp setup, welcome flow, abandoned cart, post-purchase sequences and campaign templates.' },
      { icon: '📊', title: 'Analytics Setup', body: 'GA4, Meta Pixel, TikTok Pixel, UTM framework and monthly reporting dashboard setup.' },
    ],
    cta: 'Start Brand Project',
  },
];

export function findSolution(slug: string): Solution | undefined {
  return SOLUTIONS.find((s) => s.slug === slug);
}
