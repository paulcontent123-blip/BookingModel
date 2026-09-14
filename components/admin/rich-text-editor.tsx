'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type BlockAlign,
  type DocBlock,
  type HeadingLevel,
  type InlineNode,
  type TableCell,
  buildToc,
  parseDoc,
  serializeDoc,
  type TocEntry,
} from '@/lib/content-doc';
import { uploadCover, validateCoverFile } from '@/components/admin/cover-picker';

/**
 * The article body editor.
 *
 * A contenteditable surface drives the familiar toolbar, but the DOM is never
 * what gets saved: on every edit it is walked and serialised into the block
 * document in lib/content-doc.ts, which the hidden input carries to the server.
 * Anything the browser (or a paste) produced that is not in the model is simply
 * dropped, so the public page never has to trust stored markup.
 */

const BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'UL', 'OL', 'BLOCKQUOTE', 'TABLE']);
type InlineMarks = { bold: boolean; italic: boolean; heading?: HeadingLevel };

function headingLevelFrom(value: unknown): HeadingLevel | undefined {
  const level = Math.trunc(Number(value));
  return level === 1 || level === 2 || level === 3 ? level : undefined;
}

function headingLevelOf(element: HTMLElement): HeadingLevel | undefined {
  return headingLevelFrom(element.dataset.headingLevel);
}

// ── DOM → document ─────────────────────────────────────────────────────────

  /** Collects text and inline marks. "\n" marks a <br>. */
function collectInline(
  node: Node,
  marks: InlineMarks,
  out: InlineNode[],
): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (!text) return;
    const heading = marks.heading;
    out.push({
      text,
      ...(marks.bold ? { bold: true } : {}),
      ...(marks.italic ? { italic: true } : {}),
      ...(heading ? { heading } : {}),
    });
    return;
  }

  if (!(node instanceof HTMLElement)) return;
  if (node.tagName === 'BR') {
    out.push({ text: '\n' });
    return;
  }

  const weight = node.style.fontWeight;
  const heading = headingLevelOf(node) ?? marks.heading;
  const next = {
    bold:
      marks.bold ||
      node.tagName === 'B' ||
      node.tagName === 'STRONG' ||
      weight === 'bold' ||
      Number(weight) >= 600,
    italic:
      marks.italic ||
      node.tagName === 'I' ||
      node.tagName === 'EM' ||
      node.style.fontStyle === 'italic',
    ...(heading ? { heading } : {}),
  };

  for (const child of Array.from(node.childNodes)) collectInline(child, next, out);
}

function normalizeInline(nodes: InlineNode[]): InlineNode[] {
  const merged: InlineNode[] = [];
  for (const node of nodes) {
    if (!node.text) continue;
    const previous = merged.at(-1);
    if (
      previous &&
      !!previous.bold === !!node.bold &&
      !!previous.italic === !!node.italic &&
      previous.heading === node.heading
    ) {
      previous.text += node.text;
    } else {
      merged.push({ ...node });
    }
  }
  if (merged.length) {
    merged[0]!.text = merged[0]!.text.replace(/^\s+/, '');
    merged.at(-1)!.text = merged.at(-1)!.text.replace(/\s+$/, '');
  }
  return merged.filter((node) => node.text.length > 0);
}

/** Inline content with every <br> collapsed to a space (headings, cells). */
function inlineOf(element: HTMLElement): InlineNode[] {
  const raw: InlineNode[] = [];
  for (const child of Array.from(element.childNodes)) {
    collectInline(child, { bold: false, italic: false }, raw);
  }
  return normalizeInline(raw.map((node) => ({ ...node, text: node.text.replace(/\n/g, ' ') })));
}

/** Inline content split at every <br>, so a soft break becomes its own line. */
function inlineRunsOf(element: HTMLElement): InlineNode[][] {
  const raw: InlineNode[] = [];
  for (const child of Array.from(element.childNodes)) {
    collectInline(child, { bold: false, italic: false }, raw);
  }

  const runs: InlineNode[][] = [[]];
  for (const node of raw) {
    const parts = node.text.split('\n');
    parts.forEach((part, index) => {
      if (index > 0) runs.push([]);
      if (part) runs.at(-1)!.push({ ...node, text: part });
    });
  }

  return runs.map(normalizeInline).filter((run) => run.length > 0);
}

function alignOf(element: HTMLElement): BlockAlign | undefined {
  const value = element.style.textAlign;
  return value === 'center' || value === 'right' ? value : undefined;
}

/** A block wrapper holding nothing but an image is an image block. */
function loneImage(element: HTMLElement): HTMLImageElement | null {
  const images = element.querySelectorAll('img');
  if (images.length !== 1) return null;
  return (element.textContent ?? '').trim() === '' ? images[0]! : null;
}

function tableToBlock(table: HTMLTableElement): DocBlock | null {
  const rows: TableCell[][] = [];

  for (const tr of Array.from(table.querySelectorAll('tr'))) {
    const cells: TableCell[] = [];
    for (const cell of Array.from(tr.children)) {
      if (!(cell instanceof HTMLTableCellElement)) continue;
      cells.push({
        content: inlineOf(cell),
        ...(cell.tagName === 'TH' ? { header: true } : {}),
        ...(cell.colSpan > 1 ? { colSpan: cell.colSpan } : {}),
        ...(cell.rowSpan > 1 ? { rowSpan: cell.rowSpan } : {}),
      });
    }
    if (cells.length) rows.push(cells);
  }

  return rows.length ? { type: 'table', rows } : null;
}

function elementToBlocks(element: HTMLElement): DocBlock[] {
  const tag = element.tagName;

  if (tag === 'H1' || tag === 'H2' || tag === 'H3') {
    const content = inlineOf(element);
    if (!content.length) return [];
    return [
      {
        type: 'heading',
        level: tag === 'H1' ? 1 : tag === 'H2' ? 2 : 3,
        align: alignOf(element),
        content,
      },
    ];
  }

  if (tag === 'UL' || tag === 'OL') {
    const items = Array.from(element.children)
      .filter((child): child is HTMLElement => child instanceof HTMLElement && child.tagName === 'LI')
      .map(inlineOf)
      .filter((item) => item.length > 0);
    return items.length ? [{ type: 'list', ordered: tag === 'OL', items }] : [];
  }

  if (tag === 'BLOCKQUOTE') {
    const content = inlineOf(element);
    return content.length ? [{ type: 'quote', content }] : [];
  }

  if (tag === 'TABLE') {
    const block = tableToBlock(element as HTMLTableElement);
    return block ? [block] : [];
  }

  if (tag === 'IMG') {
    const image = element as HTMLImageElement;
    return [{ type: 'image', url: image.src, alt: image.alt ?? '' }];
  }

  const image = loneImage(element);
  if (image) {
    return [{ type: 'image', url: image.src, alt: image.alt ?? '', align: alignOf(element) }];
  }

  // A wrapper div can still hold real blocks (Chrome does this after a paste).
  const nested = Array.from(element.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement && BLOCK_TAGS.has(child.tagName),
  );
  if (nested.length && tag === 'DIV') {
    return nested.flatMap(elementToBlocks);
  }

  const align = alignOf(element);
  return inlineRunsOf(element).map((content) => ({ type: 'paragraph', align, content }));
}

export function serializeEditor(root: HTMLElement): DocBlock[] {
  const blocks: DocBlock[] = [];

  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = (child.textContent ?? '').trim();
      if (text) blocks.push({ type: 'paragraph', content: [{ text }] });
      continue;
    }
    if (child instanceof HTMLElement) blocks.push(...elementToBlocks(child));
  }

  return blocks;
}

// ── Document → DOM ─────────────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineToHtml(content: InlineNode[]): string {
  if (!content.length) return '<br>';
  return content
    .map((node) => {
      let html = escapeHtml(node.text);
      if (node.italic) html = `<i>${html}</i>`;
      if (node.bold) html = `<b>${html}</b>`;
      if (node.heading) {
        html = `<span data-heading-level="${node.heading}" class="rte-inline-heading rte-inline-heading-${node.heading}">${html}</span>`;
      }
      return html;
    })
    .join('');
}

function alignAttr(align: BlockAlign | undefined): string {
  return align ? ` style="text-align:${align}"` : '';
}

function blockToHtml(block: DocBlock): string {
  switch (block.type) {
    case 'heading':
      // Keep headings inline in the editing surface. This lets an editor
      // select only part of a line and change only that range, including for
      // articles created with the older block-heading format.
      return `<p${alignAttr(block.align)}><span data-heading-level="${block.level}" class="rte-inline-heading rte-inline-heading-${block.level}">${inlineToHtml(block.content)}</span></p>`;
    case 'paragraph':
      return `<p${alignAttr(block.align)}>${inlineToHtml(block.content)}</p>`;
    case 'quote':
      return `<blockquote>${inlineToHtml(block.content)}</blockquote>`;
    case 'list': {
      const tag = block.ordered ? 'ol' : 'ul';
      const items = block.items.map((item) => `<li>${inlineToHtml(item)}</li>`).join('');
      return `<${tag}>${items}</${tag}>`;
    }
    case 'image':
      return `<p${alignAttr(block.align)}><img src="${escapeHtml(block.url)}" alt="${escapeHtml(block.alt)}"></p>`;
    case 'table': {
      const rows = block.rows
        .map((row) => {
          const cells = row
            .map((cell) => {
              const tag = cell.header ? 'th' : 'td';
              const spans =
                (cell.colSpan && cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : '') +
                (cell.rowSpan && cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : '');
              return `<${tag}${spans}>${inlineToHtml(cell.content)}</${tag}>`;
            })
            .join('');
          return `<tr>${cells}</tr>`;
        })
        .join('');
      return `<table><tbody>${rows}</tbody></table>`;
    }
  }
}

function blocksToHtml(blocks: DocBlock[]): string {
  return blocks.length ? blocks.map(blockToHtml).join('') : '<p><br></p>';
}

// ── Editor ─────────────────────────────────────────────────────────────────

interface ToolbarButton {
  label: string;
  title: string;
  run: () => void;
  wide?: boolean;
}

function selectedTextNodes(root: HTMLElement, range: Range): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    if (node.textContent && range.intersectsNode(node)) nodes.push(node as Text);
    node = walker.nextNode();
  }
  return nodes;
}

/** Removes only heading marks contained by this selected fragment. */
function unwrapHeadingMarks(fragment: DocumentFragment): void {
  for (const wrapper of Array.from(fragment.querySelectorAll<HTMLElement>('[data-heading-level]'))) {
    const parent = wrapper.parentNode;
    if (!parent) continue;
    while (wrapper.firstChild) parent.insertBefore(wrapper.firstChild, wrapper);
    wrapper.remove();
  }
}

export function RichTextEditor({
  name,
  initialBody,
  onTocChange,
}: {
  name: string;
  initialBody: string | null | undefined;
  /** Sends the live H2/H3 list to the form's preview. */
  onTocChange?: (entries: TocEntry[]) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [inTable, setInTable] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialValue = serializeDoc(parseDoc(initialBody));
  // Keep the form control in React state as well as updating it imperatively.
  // The parent re-renders when the live TOC changes; an uncontrolled hidden
  // input can otherwise briefly fall back to its initial empty document while
  // the visible contenteditable still contains the text the user entered.
  const [serializedBody, setSerializedBody] = useState(initialValue);

  /** Walks the DOM into the document and pushes it onto the hidden input. */
  const sync = useCallback(() => {
    const root = editorRef.current;
    const hidden = hiddenRef.current;
    if (!root || !hidden) return;

    const blocks = serializeEditor(root);
    const serialized = serializeDoc(blocks);
    hidden.value = serialized;
    setSerializedBody(serialized);
    onTocChange?.(buildToc(blocks));
  }, [onTocChange]);

  // Mount the stored body once. React must not own this subtree afterwards,
  // or every re-render would blow away the caret.
  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;
    root.innerHTML = blocksToHtml(parseDoc(initialBody));
    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focusEditor = () => editorRef.current?.focus();

  function exec(command: string, value?: string) {
    focusEditor();
    document.execCommand(command, false, value);
    sync();
  }

  function currentCell(): HTMLTableCellElement | null {
    const selection = window.getSelection();
    let node: Node | null = selection?.anchorNode ?? null;
    while (node && node !== editorRef.current) {
      if (node instanceof HTMLTableCellElement) return node;
      node = node.parentNode;
    }
    return null;
  }

  const refreshTableState = useCallback(() => setInTable(currentCell() !== null), []);

  /** Applies H1/H2/H3 to the exact selected text range. */
  function setInlineHeading(level: HeadingLevel) {
    const selection = window.getSelection();
    const root = editorRef.current;
    if (
      !selection ||
      selection.isCollapsed ||
      !selection.rangeCount ||
      !root?.contains(selection.anchorNode) ||
      !root.contains(selection.focusNode)
    ) return;

    const range = selection.getRangeAt(0);
    const nodes = selectedTextNodes(root, range);
    if (!nodes.length) return;

    focusEditor();

    let firstWrapped: HTMLElement | null = null;
    let lastWrapped: HTMLElement | null = null;

    // Work backwards so splitting a text node never invalidates the offsets
    // of text nodes that still need to be processed.
    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      const node = nodes[index]!;
      const start = node === range.startContainer ? Math.min(range.startOffset, node.length) : 0;
      const end = node === range.endContainer ? Math.min(range.endOffset, node.length) : node.length;
      if (end <= start) continue;

      let selectedNode = node;
      if (start > 0) selectedNode = selectedNode.splitText(start);
      if (end - start < selectedNode.length) selectedNode.splitText(end - start);

      const wrapper = document.createElement('span');
      wrapper.dataset.headingLevel = String(level);
      wrapper.className = `rte-inline-heading rte-inline-heading-${level}`;
      selectedNode.parentNode?.replaceChild(wrapper, selectedNode);
      wrapper.appendChild(selectedNode);

      if (!lastWrapped) lastWrapped = wrapper;
      firstWrapped = wrapper;
    }

    if (firstWrapped && lastWrapped) {
      const nextRange = document.createRange();
      nextRange.setStartBefore(firstWrapped);
      nextRange.setEndAfter(lastWrapped);
      selection.removeAllRanges();
      selection.addRange(nextRange);
    }
    sync();
  }

  /** Block formatting is retained for Quote, which is genuinely block-level. */
  function setBlock(tag: string) {
    const selection = window.getSelection();
    const root = editorRef.current;
    if (!selection || !selection.rangeCount || !root?.contains(selection.anchorNode)) return;

    focusEditor();
    const formatted = document.execCommand('formatBlock', false, tag);
    if (!formatted) document.execCommand('formatBlock', false, `<${tag}>`);
    sync();
  }

  /** Removes every inline mark from only the current selection. */
  function clearFormatting() {
    const selection = window.getSelection();
    const root = editorRef.current;
    if (!selection || !selection.rangeCount || !root?.contains(selection.anchorNode)) return;

    focusEditor();
    document.execCommand('removeFormat');
    document.execCommand('justifyLeft');

    const currentSelection = window.getSelection();
    if (currentSelection && currentSelection.rangeCount) {
      const range = currentSelection.getRangeAt(0).cloneRange();
      const fragment = range.extractContents();
      unwrapHeadingMarks(fragment);
      range.insertNode(fragment);
    }
    sync();
  }

  function insertTable() {
    const header = '<tr><th>Column 1</th><th>Column 2</th><th>Column 3</th></tr>';
    const row = '<tr><td><br></td><td><br></td><td><br></td></tr>';
    exec('insertHTML', `<table><tbody>${header}${row}${row}</tbody></table><p><br></p>`);
    refreshTableState();
  }

  function withTable(mutate: (cell: HTMLTableCellElement, row: HTMLTableRowElement, table: HTMLTableElement) => void) {
    const cell = currentCell();
    const row = cell?.parentElement;
    const table = cell?.closest('table');
    if (!cell || !(row instanceof HTMLTableRowElement) || !table) return;
    mutate(cell, row, table);
    sync();
    refreshTableState();
  }

  function newCell(header: boolean): HTMLTableCellElement {
    const cell = document.createElement(header ? 'th' : 'td');
    cell.appendChild(document.createElement('br'));
    return cell;
  }

  function addRow(below: boolean) {
    withTable((cell, row) => {
      const fresh = document.createElement('tr');
      for (const sibling of Array.from(row.children)) {
        fresh.appendChild(newCell(sibling.tagName === 'TH' && !below && row.rowIndex === 0));
      }
      row.parentElement?.insertBefore(fresh, below ? row.nextSibling : row);
    });
  }

  function removeRow() {
    withTable((cell, row, table) => {
      if (table.rows.length <= 1) table.remove();
      else row.remove();
    });
  }

  function addColumn(after: boolean) {
    withTable((cell, row, table) => {
      const index = cell.cellIndex + (after ? 1 : 0);
      for (const tableRow of Array.from(table.rows)) {
        const header = tableRow.cells[0]?.tagName === 'TH';
        const fresh = newCell(header);
        const reference = tableRow.cells[index] ?? null;
        tableRow.insertBefore(fresh, reference);
      }
    });
  }

  function removeColumn() {
    withTable((cell, row, table) => {
      const index = cell.cellIndex;
      if ((table.rows[0]?.cells.length ?? 0) <= 1) {
        table.remove();
        return;
      }
      for (const tableRow of Array.from(table.rows)) tableRow.cells[index]?.remove();
    });
  }

  /** Swaps the first row between <th> and <td>. */
  function toggleHeaderRow() {
    withTable((cell, row, table) => {
      const first = table.rows[0];
      if (!first) return;
      const makeHeader = first.cells[0]?.tagName !== 'TH';
      for (const original of Array.from(first.cells)) {
        const replacement = document.createElement(makeHeader ? 'th' : 'td');
        replacement.innerHTML = original.innerHTML;
        if (original.colSpan > 1) replacement.colSpan = original.colSpan;
        if (original.rowSpan > 1) replacement.rowSpan = original.rowSpan;
        original.replaceWith(replacement);
      }
    });
  }

  /**
   * Splits a merged cell back apart, or merges the cell with the ones selected
   * to its right in the same row (falling back to the next neighbour).
   */
  function mergeOrSplitCell() {
    withTable((cell, row) => {
      if (cell.colSpan > 1 || cell.rowSpan > 1) {
        const extra = cell.colSpan - 1;
        cell.colSpan = 1;
        cell.rowSpan = 1;
        for (let i = 0; i < extra; i += 1) {
          row.insertBefore(newCell(cell.tagName === 'TH'), cell.nextSibling);
        }
        return;
      }

      const selection = window.getSelection();
      const selected = Array.from(row.cells).filter(
        (candidate) =>
          candidate !== cell &&
          selection?.rangeCount === 1 &&
          selection.getRangeAt(0).intersectsNode(candidate),
      );
      const targets = selected.length ? selected : [row.cells[cell.cellIndex + 1]].filter(Boolean);
      if (!targets.length) return;

      for (const target of targets as HTMLTableCellElement[]) {
        const text = (target.textContent ?? '').trim();
        if (text) cell.innerHTML = `${cell.innerHTML} ${target.innerHTML}`;
        cell.colSpan += target.colSpan;
        target.remove();
      }
    });
  }

  async function insertImage(file: File) {
    const invalid = validateCoverFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const url = await uploadCover(file);
      const alt = window.prompt('Image description (alt text, used for SEO):', '') ?? '';
      exec('insertHTML', `<p><img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}"></p><p><br></p>`);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : 'The image could not be uploaded.',
      );
    } finally {
      setUploading(false);
    }
  }

  const buttons: ToolbarButton[] = [
    { label: 'B', title: 'Bold', run: () => exec('bold') },
    { label: 'I', title: 'Italic', run: () => exec('italic') },
    { label: 'H1', title: 'Heading 1 for the selected text only', run: () => setInlineHeading(1) },
    { label: 'H2', title: 'Heading 2 for the selected text only', run: () => setInlineHeading(2) },
    { label: 'H3', title: 'Heading 3 for the selected text only', run: () => setInlineHeading(3) },
    { label: 'List', title: 'Bullet list', run: () => exec('insertUnorderedList') },
    { label: '1. List', title: 'Numbered list', run: () => exec('insertOrderedList') },
    { label: 'Left', title: 'Align left', run: () => exec('justifyLeft') },
    { label: 'Center', title: 'Align center', run: () => exec('justifyCenter') },
    { label: 'Right', title: 'Align right', run: () => exec('justifyRight') },
    { label: '🖼 Image', title: 'Upload an image to Cloudinary', run: () => fileRef.current?.click() },
    { label: '▦ Table', title: 'Insert a 3×3 table', run: insertTable },
    { label: '❝ Quote', title: 'Pull quote', run: () => setBlock('blockquote') },
    { label: '✕ Clear', title: 'Remove all formatting from the selected text, including H1/H2/H3', run: clearFormatting },
  ];

  const tableButtons: ToolbarButton[] = [
    { label: '+ Row above', title: 'Insert a row above', run: () => addRow(false) },
    { label: '+ Row below', title: 'Insert a row below', run: () => addRow(true) },
    { label: '− Row', title: 'Delete this row', run: removeRow },
    { label: '+ Col left', title: 'Insert a column to the left', run: () => addColumn(false) },
    { label: '+ Col right', title: 'Insert a column to the right', run: () => addColumn(true) },
    { label: '− Col', title: 'Delete this column', run: removeColumn },
    { label: 'Header row', title: 'Toggle the first row as a header', run: toggleHeaderRow },
    { label: 'Merge / Split', title: 'Merge with the cell to the right, or split a merged cell', run: mergeOrSplitCell },
    {
      label: '🗑 Table',
      title: 'Delete the whole table',
      run: () => withTable((cell, row, table) => table.remove()),
    },
  ];

  return (
    <div className="rte">
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="rte-bar">
        {buttons.map((button) => (
          <button
            key={button.label}
            type="button"
            className="rte-btn"
            title={button.title}
            disabled={uploading && button.label === '🖼 Image'}
            onMouseDown={(event) => event.preventDefault()}
            onClick={button.run}
          >
            {uploading && button.label === '🖼 Image' ? 'Uploading…' : button.label}
          </button>
        ))}
      </div>

      {inTable && (
        <div className="rte-bar rte-bar-sub">
          <span className="rte-bar-label">Table</span>
          {tableButtons.map((button) => (
            <button
              key={button.label}
              type="button"
              className="rte-btn"
              title={button.title}
              onMouseDown={(event) => event.preventDefault()}
              onClick={button.run}
            >
              {button.label}
            </button>
          ))}
        </div>
      )}

      <div
        ref={editorRef}
        className="rte-surface art-body"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Article body"
        onInput={sync}
        onBlur={sync}
        onKeyUp={refreshTableState}
        onMouseUp={refreshTableState}
        onFocus={refreshTableState}
        // Paste as plain text: styles from Word or another site never enter the
        // document, and the block model stays the only source of formatting.
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData.getData('text/plain');
          document.execCommand('insertText', false, text);
          sync();
        }}
      />

      <input ref={hiddenRef} id={name} type="hidden" name={name} value={serializedBody} readOnly />
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void insertImage(file);
        }}
      />
    </div>
  );
}
