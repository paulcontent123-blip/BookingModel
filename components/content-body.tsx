import type { ReactNode } from 'react';
import {
  buildToc,
  groupToc,
  headingAnchorKey,
  headingAnchors,
  parseDoc,
  type DocBlock,
  type InlineNode,
} from '@/lib/content-doc';

function InlineContent({
  content,
  path,
  anchors,
}: {
  content: InlineNode[];
  path: number[];
  anchors: Map<string, string>;
}) {
  return content.map((node, index) => {
    let value: ReactNode = node.text;
    if (node.heading) {
      value = (
        <span
          id={anchors.get(headingAnchorKey(...path, index))}
          className={`inline-heading inline-heading-${node.heading}`}
        >
          {value}
        </span>
      );
    }
    if (node.italic) value = <em>{value}</em>;
    if (node.bold) value = <strong>{value}</strong>;
    return <span key={index}>{value}</span>;
  });
}

function TableOfContents({ body }: { body: DocBlock[] }) {
  const entries = buildToc(body);
  if (!entries.length) return null;

  return (
    <nav className="article-toc" aria-label="Table of contents">
      <div className="article-toc-title">Table of contents</div>
      <ol className="article-toc-list">
        {groupToc(entries).map((section, index) => {
          if (!section.parent) {
            return (
              <li key={`orphan-${index}`} className="article-toc-orphan">
                <ul>
                  {section.children.map((entry) => (
                    <li key={entry.id}><a href={`#${entry.id}`}>{entry.text}</a></li>
                  ))}
                </ul>
              </li>
            );
          }

          return (
            <li key={section.parent.id}>
              <a href={`#${section.parent.id}`}>
                <span className="article-toc-number">{section.parent.number}.</span>{' '}
                {section.parent.text}
              </a>
              {section.children.length > 0 && (
                <ul>
                  {section.children.map((entry) => (
                    <li key={entry.id}><a href={`#${entry.id}`}>{entry.text}</a></li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function BlockContent({ block, index, anchors }: { block: DocBlock; index: number; anchors: Map<string, string> }) {
  switch (block.type) {
    case 'heading': {
      const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3';
      return (
        <Tag key={index} id={anchors.get(headingAnchorKey(index))} style={block.align ? { textAlign: block.align } : undefined}>
          <InlineContent content={block.content} path={[index]} anchors={anchors} />
        </Tag>
      );
    }
    case 'paragraph':
      return (
        <p key={index} style={block.align ? { textAlign: block.align } : undefined}>
          <InlineContent content={block.content} path={[index]} anchors={anchors} />
        </p>
      );
    case 'quote':
      return <blockquote key={index}><InlineContent content={block.content} path={[index]} anchors={anchors} /></blockquote>;
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag key={index}>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>
              <InlineContent content={item} path={[index, itemIndex]} anchors={anchors} />
            </li>
          ))}
        </Tag>
      );
    }
    case 'image':
      return (
        <figure key={index} className="article-inline-image" style={block.align ? { textAlign: block.align } : undefined}>
          <img src={block.url} alt={block.alt} loading="lazy" />
        </figure>
      );
    case 'table':
      return (
        <div key={index} className="article-table-wrap">
          <table>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => {
                    const props = {
                      key: cellIndex,
                      colSpan: cell.colSpan,
                      rowSpan: cell.rowSpan,
                    };
                    return cell.header ? (
                      <th {...props}>
                        <InlineContent content={cell.content} path={[index, rowIndex, cellIndex]} anchors={anchors} />
                      </th>
                    ) : (
                      <td {...props}>
                        <InlineContent content={cell.content} path={[index, rowIndex, cellIndex]} anchors={anchors} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

/**
 * Renders an article body written in the admin editor.
 *
 * The stored block document is reconstructed as real elements — no HTML from
 * the database is ever injected into the page. Showcase sections leave the
 * contents box off; news articles opt in explicitly.
 */
export function ContentBody({ body, showToc = false }: { body: string | null | undefined; showToc?: boolean }) {
  const blocks = parseDoc(body);
  if (!blocks.length) return null;
  const anchors = headingAnchors(blocks);

  return (
    <>
      {showToc && <TableOfContents body={blocks} />}
      <div className="art-body">
        {blocks.map((block, index) => <BlockContent key={index} block={block} index={index} anchors={anchors} />)}
      </div>
    </>
  );
}
