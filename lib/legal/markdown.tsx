import type { ReactNode } from "react";

function inline(text: string, keyPrefix: string): ReactNode[] {
  const tokenPattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\((?:https?:\/\/|#)[^)]+\))/g;
  return text.split(tokenPattern).filter(Boolean).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={key}>{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={key}>{part.slice(1, -1)}</em>;
    const link = /^\[([^\]]+)\]\(((?:https?:\/\/|#)[^)]+)\)$/.exec(part);
    if (link) {
      const external = link[2].startsWith("http");
      return <a key={key} href={link[2]} className="font-medium text-ink underline" {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>{link[1]}</a>;
    }
    return part;
  });
}

function tableCells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function isBlockStart(lines: string[], index: number): boolean {
  const line = lines[index];
  return !line.trim()
    || /^#{1,6}\s/.test(line)
    || /^---+$/.test(line.trim())
    || /^\s*>/.test(line)
    || /^\s*(?:[-*]|\d+\.)\s/.test(line)
    || (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(lines[index + 1] ?? ""));
}

export function LegalMarkdown({ markdown }: { markdown: string }) {
  const lines = markdown.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const classes = level === 1 ? "mb-5 text-3xl font-semibold" : level === 2 ? "mb-3 mt-8 text-xl font-semibold" : "mb-2 mt-5 text-lg font-semibold";
      const children = inline(heading[2], `heading-${index}`);
      const key = `heading-${index}`;
      blocks.push(level === 1
        ? <h1 key={key} className={classes}>{children}</h1>
        : level === 2
          ? <h2 key={key} className={classes}>{children}</h2>
          : <h3 key={key} className={classes}>{children}</h3>);
      index += 1;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      blocks.push(<hr key={`rule-${index}`} className="my-6 border-line-soft" />);
      index += 1;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quoted: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        quoted.push(lines[index].replace(/^\s*>\s?/, "").trim());
        index += 1;
      }
      blocks.push(<blockquote key={`quote-${index}`} className="my-4 border-l-2 border-line-soft pl-4 text-muted">{inline(quoted.join(" "), `quote-${index}`)}</blockquote>);
      continue;
    }

    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(lines[index + 1] ?? "")) {
      const headers = tableCells(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      blocks.push(
        <div key={`table-${index}`} className="my-4 overflow-x-auto">
          <table className="w-full border-collapse text-left type-body-sm">
            <thead><tr>{headers.map((cell, cellIndex) => <th key={cellIndex} className="border border-line-soft bg-surface-2 p-2 font-semibold">{inline(cell, `th-${index}-${cellIndex}`)}</th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, cellIndex) => <td key={cellIndex} className="border border-line-soft p-2 align-top">{inline(row[cellIndex] ?? "", `td-${index}-${rowIndex}-${cellIndex}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }

    const listMatch = /^\s*([-*]|\d+\.)\s+(.*)$/.exec(line);
    if (listMatch) {
      const ordered = /^\d/.test(listMatch[1]);
      const items: string[] = [];
      while (index < lines.length) {
        const item = /^\s*([-*]|\d+\.)\s+(.*)$/.exec(lines[index]);
        if (!item || /^\d/.test(item[1]) !== ordered) break;
        items.push(item[2]);
        index += 1;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(<List key={`list-${index}`} className={`my-3 space-y-1 pl-6 ${ordered ? "list-decimal" : "list-disc"}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{inline(item, `li-${index}-${itemIndex}`)}</li>)}</List>);
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && !isBlockStart(lines, index)) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    if (paragraph.length) blocks.push(<p key={`paragraph-${index}`} className="my-3 leading-7">{inline(paragraph.join(" "), `p-${index}`)}</p>);
    else index += 1;
  }

  return <article className="text-ink">{blocks}</article>;
}
