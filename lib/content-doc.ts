/**
 * The document model behind the article editor.
 *
 * The admin editor is a contenteditable surface, but what gets stored is never
 * its HTML — the browser serialises the DOM into this block tree, the server
 * re-validates it against the shapes below, and the public page renders it as
 * real React elements. Sanitising by reconstruction means no markup from the
 * database is ever injected into a page.
 *
 * Bodies written before the editor existed are plain text; parseDoc detects
 * that and converts them on the fly, so nothing has to be migrated. Heading
 * blocks remain supported for backwards compatibility, while new heading
 * toolbar actions are stored as inline marks on the selected text range.
 */

export const DOC_VERSION = 1;

export type BlockAlign = 'left' | 'center' | 'right';
export type HeadingLevel = 1 | 2 | 3;

export interface InlineNode {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Heading size applied to this text range, rather than its whole block. */
  heading?: HeadingLevel;
}

export interface HeadingBlock {
  type: 'heading';
  level: HeadingLevel;
  align?: BlockAlign;
  content: InlineNode[];
}

export interface ParagraphBlock {
  type: 'paragraph';
  align?: BlockAlign;
  content: InlineNode[];
}

export interface ListBlock {
  type: 'list';
  ordered: boolean;
  items: InlineNode[][];
}

export interface QuoteBlock {
  type: 'quote';
  content: InlineNode[];
}

export interface ImageBlock {
  type: 'image';
  url: string;
  alt: string;
  align?: BlockAlign;
}

export interface TableCell {
  content: InlineNode[];
  header?: boolean;
  colSpan?: number;
  rowSpan?: number;
}

export interface TableBlock {
  type: 'table';
  rows: TableCell[][];
}

export type DocBlock =
  | HeadingBlock
  | ParagraphBlock
  | ListBlock
  | QuoteBlock
  | ImageBlock
  | TableBlock;

export interface ContentDoc {
  version: number;
  blocks: DocBlock[];
}

/** Control characters survive JSON but have no place in body copy. */
const CONTROL_CHARS = new RegExp('[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]', 'g');
/** Combining accents, removed after NFD so anchors are plain ASCII. */
const COMBINING_MARKS = new RegExp('[\u0300-\u036F]', 'g');

const ALIGNS: BlockAlign[] = ['left', 'center', 'right'];
const MAX_BLOCKS = 2000;
const MAX_TABLE_ROWS = 200;
const MAX_TABLE_COLS = 20;
const MAX_SPAN = 20;

// ── Reading ────────────────────────────────────────────────────────────────

/** Turns a stored body into blocks, accepting both the JSON doc and legacy text. */
export function parseDoc(body: string | null | undefined): DocBlock[] {
  const source = (body ?? '').trim();
  if (!source) return [];

  if (source.startsWith('{')) {
    try {
      return sanitizeBlocks((JSON.parse(source) as ContentDoc)?.blocks);
    } catch {
      // Not a document after all — fall through and read it as text.
    }
  }

  return legacyTextToBlocks(source);
}

export function serializeDoc(blocks: DocBlock[]): string {
  return JSON.stringify({ version: DOC_VERSION, blocks } satisfies ContentDoc);
}

export function isEmptyDoc(blocks: DocBlock[]): boolean {
  return blocks.every((block) => {
    if (block.type === 'image' || block.type === 'table') return false;
    return docBlockText(block).trim().length === 0;
  });
}

export function inlineText(content: InlineNode[]): string {
  return content.map((node) => node.text).join('');
}

function docBlockText(block: DocBlock): string {
  switch (block.type) {
    case 'heading':
    case 'paragraph':
    case 'quote':
      return inlineText(block.content);
    case 'list':
      return block.items.map(inlineText).join(' ');
    case 'table':
      return block.rows.map((row) => row.map((cell) => inlineText(cell.content)).join(' ')).join(' ');
    case 'image':
      return block.alt;
  }
}

/** Flat text, used for reading time, auto excerpts and search descriptions. */
export function docToPlainText(blocks: DocBlock[]): string {
  return blocks
    .map(docBlockText)
    .filter(Boolean)
    .join('\n\n');
}

/** The first real paragraph, for the auto excerpt. */
export function docFirstParagraph(blocks: DocBlock[]): string {
  const paragraph = blocks.find(
    (block) => block.type === 'paragraph' && inlineText(block.content).trim().length > 0,
  );
  return paragraph ? inlineText((paragraph as ParagraphBlock).content).trim() : '';
}

// ── Table of contents ──────────────────────────────────────────────────────

export interface TocEntry {
  id: string;
  level: 2 | 3;
  text: string;
  /** Continuous 1..n numbering across every H2; undefined for H3. */
  number?: number;
}

/** Stable path used by both the TOC builder and the public renderer. */
export function headingAnchorKey(...path: number[]): string {
  return path.join(':');
}

/** Strips Vietnamese (and other) diacritics so anchors stay readable. */
function anchorSlug(text: string): string {
  return text
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Anchor id per heading path. A block heading uses "blockIndex"; an inline
 * heading uses the block and inline node path, for example "2:1".
 *
 * The renderer and the table of contents both call this, so the ids they emit
 * always agree. H1 is left out: the article title is already the page H1.
 */
interface HeadingReference {
  key: string;
  level: HeadingLevel;
  text: string;
}

function inlineHeadingReferences(content: InlineNode[], path: number[]): HeadingReference[] {
  return content.flatMap((node, index) => {
    if (!node.heading || node.heading === 1 || !node.text.trim()) return [];
    return [{ key: headingAnchorKey(...path, index), level: node.heading, text: node.text.trim() }];
  });
}

function headingReferences(blocks: DocBlock[]): HeadingReference[] {
  const references: HeadingReference[] = [];

  blocks.forEach((block, blockIndex) => {
    if (block.type === 'heading' && block.level !== 1) {
      const text = inlineText(block.content).trim();
      if (text) references.push({ key: headingAnchorKey(blockIndex), level: block.level, text });
    }

    switch (block.type) {
      case 'heading':
      case 'paragraph':
      case 'quote':
        references.push(...inlineHeadingReferences(block.content, [blockIndex]));
        break;
      case 'list':
        block.items.forEach((item, itemIndex) => {
          references.push(...inlineHeadingReferences(item, [blockIndex, itemIndex]));
        });
        break;
      case 'table':
        block.rows.forEach((row, rowIndex) => {
          row.forEach((cell, cellIndex) => {
            references.push(...inlineHeadingReferences(cell.content, [blockIndex, rowIndex, cellIndex]));
          });
        });
        break;
      case 'image':
        break;
    }
  });

  return references;
}

export function headingAnchors(blocks: DocBlock[]): Map<string, string> {
  const used = new Map<string, number>();
  const anchors = new Map<string, string>();

  headingReferences(blocks).forEach((reference, index) => {
    const base = anchorSlug(reference.text) || `section-${index + 1}`;
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    anchors.set(reference.key, seen === 0 ? base : `${base}-${seen + 1}`);
  });

  return anchors;
}

export function buildToc(blocks: DocBlock[]): TocEntry[] {
  const anchors = headingAnchors(blocks);
  const entries: TocEntry[] = [];
  let h2Count = 0;

  headingReferences(blocks).forEach((reference) => {
    const id = anchors.get(reference.key);
    if (!id || !reference.text) return;

    if (reference.level === 2) {
      h2Count += 1;
      entries.push({ id, level: 2, text: reference.text, number: h2Count });
    } else {
      entries.push({ id, level: 3, text: reference.text });
    }
  });

  return entries;
}

/** H3s before the first H2 have no parent, so they are grouped on their own. */
export interface TocSection {
  parent: TocEntry | null;
  children: TocEntry[];
}

export function groupToc(entries: TocEntry[]): TocSection[] {
  const sections: TocSection[] = [];
  for (const entry of entries) {
    if (entry.level === 2) {
      sections.push({ parent: entry, children: [] });
      continue;
    }
    const last = sections.at(-1);
    if (last) last.children.push(entry);
    else sections.push({ parent: null, children: [entry] });
  }
  return sections;
}

// ── Validation ─────────────────────────────────────────────────────────────
// Everything below runs on the server against whatever the browser posted.

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  // Control characters would survive JSON but have no place in body copy.
  return value.replace(CONTROL_CHARS, '');
}

function sanitizeInline(value: unknown): InlineNode[] {
  if (!Array.isArray(value)) return [];

  const nodes: InlineNode[] = [];
  for (const raw of value.slice(0, 500)) {
    if (typeof raw !== 'object' || raw === null) continue;
    const item = raw as Record<string, unknown>;
    const text = cleanText(item.text);
    if (!text) continue;

    const node: InlineNode = { text };
    if (item.bold === true) node.bold = true;
    if (item.italic === true) node.italic = true;
    const heading = Math.trunc(Number(item.heading));
    if (heading === 1 || heading === 2 || heading === 3) node.heading = heading;

    // Fold neighbours that carry the same marks so the tree stays compact.
    const previous = nodes.at(-1);
    if (
      previous &&
      !!previous.bold === !!node.bold &&
      !!previous.italic === !!node.italic &&
      previous.heading === node.heading
    ) {
      previous.text += node.text;
    } else {
      nodes.push(node);
    }
  }

  return nodes;
}

function sanitizeAlign(value: unknown): BlockAlign | undefined {
  return ALIGNS.includes(value as BlockAlign) && value !== 'left'
    ? (value as BlockAlign)
    : undefined;
}

function sanitizeSpan(value: unknown): number | undefined {
  const span = Math.trunc(Number(value));
  if (!Number.isFinite(span) || span <= 1) return undefined;
  return Math.min(span, MAX_SPAN);
}

/** Only https images are kept — the editor uploads everything to Cloudinary. */
function sanitizeImageUrl(value: unknown): string | null {
  const url = cleanText(value).trim();
  if (!/^https:\/\//i.test(url)) return null;
  try {
    return new URL(url).toString();
  } catch {
    return null;
  }
}

function sanitizeBlock(value: unknown): DocBlock | null {
  if (typeof value !== 'object' || value === null) return null;
  const block = value as Record<string, unknown>;

  switch (block.type) {
    case 'heading': {
      const level = Math.trunc(Number(block.level));
      const content = sanitizeInline(block.content);
      if (!content.length) return null;
      return {
        type: 'heading',
        level: (level === 1 || level === 2 || level === 3 ? level : 2) as HeadingLevel,
        align: sanitizeAlign(block.align),
        content,
      };
    }

    case 'paragraph': {
      const content = sanitizeInline(block.content);
      if (!content.length) return null;
      return { type: 'paragraph', align: sanitizeAlign(block.align), content };
    }

    case 'quote': {
      const content = sanitizeInline(block.content);
      if (!content.length) return null;
      return { type: 'quote', content };
    }

    case 'list': {
      if (!Array.isArray(block.items)) return null;
      const items = block.items
        .slice(0, 500)
        .map(sanitizeInline)
        .filter((item) => item.length > 0);
      if (!items.length) return null;
      return { type: 'list', ordered: block.ordered === true, items };
    }

    case 'image': {
      const url = sanitizeImageUrl(block.url);
      if (!url) return null;
      return { type: 'image', url, alt: cleanText(block.alt).slice(0, 300), align: sanitizeAlign(block.align) };
    }

    case 'table': {
      if (!Array.isArray(block.rows)) return null;
      const rows: TableCell[][] = [];
      for (const rawRow of block.rows.slice(0, MAX_TABLE_ROWS)) {
        if (!Array.isArray(rawRow)) continue;
        const row: TableCell[] = [];
        for (const rawCell of rawRow.slice(0, MAX_TABLE_COLS)) {
          if (typeof rawCell !== 'object' || rawCell === null) continue;
          const cell = rawCell as Record<string, unknown>;
          row.push({
            content: sanitizeInline(cell.content),
            ...(cell.header === true ? { header: true } : {}),
            ...(sanitizeSpan(cell.colSpan) ? { colSpan: sanitizeSpan(cell.colSpan) } : {}),
            ...(sanitizeSpan(cell.rowSpan) ? { rowSpan: sanitizeSpan(cell.rowSpan) } : {}),
          });
        }
        if (row.length) rows.push(row);
      }
      if (!rows.length) return null;
      return { type: 'table', rows };
    }

    default:
      return null;
  }
}

export function sanitizeBlocks(value: unknown): DocBlock[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_BLOCKS)
    .map(sanitizeBlock)
    .filter((block): block is DocBlock => block !== null);
}

// ── Legacy plain-text bodies ───────────────────────────────────────────────

/**
 * The original body format: a blank line separates blocks, "## " marks a
 * heading and a run of "- " lines is a bullet list. Still used by the showcase
 * sections, and by any article written before the editor landed.
 */
export function legacyTextToBlocks(body: string | null | undefined): DocBlock[] {
  const source = (body ?? '').replace(/\r\n/g, '\n').trim();
  if (!source) return [];

  const blocks: DocBlock[] = [];

  for (const chunk of source.split(/\n{2,}/)) {
    const lines = chunk.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;

    if (lines.every((line) => /^[-*•]\s+/.test(line))) {
      blocks.push({
        type: 'list',
        ordered: false,
        items: lines.map((line) => [{ text: line.replace(/^[-*•]\s+/, '') }]),
      });
      continue;
    }

    let paragraph: string[] = [];
    const flush = () => {
      if (paragraph.length) blocks.push({ type: 'paragraph', content: [{ text: paragraph.join(' ') }] });
      paragraph = [];
    };

    for (const line of lines) {
      const heading = /^(#{2,3})\s+(.*)$/.exec(line);
      if (heading) {
        flush();
        blocks.push({
          type: 'heading',
          level: heading[1]!.length === 2 ? 2 : 3,
          content: [{ text: heading[2]!.trim() }],
        });
      } else {
        paragraph.push(line);
      }
    }
    flush();
  }

  return blocks;
}
