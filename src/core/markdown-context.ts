export interface TextRange {
  start: number;
  end: number;
}

export function getMarkdownCodeRanges(markdown: string): TextRange[] {
  const fencedRanges: TextRange[] = [];
  const lineRegex = /.*(?:\n|$)/g;
  let fence: { marker: string; start: number } | null = null;
  let lineMatch: RegExpExecArray | null;

  while ((lineMatch = lineRegex.exec(markdown)) !== null && lineMatch[0]) {
    const line = lineMatch[0].replace(/\n$/, '');
    const markerMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);

    if (!fence && markerMatch) {
      fence = { marker: markerMatch[1], start: lineMatch.index };
    } else if (fence && markerMatch) {
      const candidate = markerMatch[1];
      const sameMarker = candidate[0] === fence.marker[0] && candidate.length >= fence.marker.length;
      const trailing = line.slice(markerMatch[0].length);
      if (sameMarker && /^\s*$/.test(trailing)) {
        fencedRanges.push({ start: fence.start, end: lineMatch.index + lineMatch[0].length });
        fence = null;
      }
    }
  }

  if (fence) fencedRanges.push({ start: fence.start, end: markdown.length });

  const inlineRanges: TextRange[] = [];
  const ticksRegex = /`+/g;
  let tickMatch: RegExpExecArray | null;
  while ((tickMatch = ticksRegex.exec(markdown)) !== null) {
    if (isIndexInRanges(tickMatch.index, fencedRanges)) continue;

    const delimiter = tickMatch[0];
    const lineEnd = markdown.indexOf('\n', ticksRegex.lastIndex);
    const searchEnd = lineEnd === -1 ? markdown.length : lineEnd;
    const closingIndex = markdown.indexOf(delimiter, ticksRegex.lastIndex);
    if (closingIndex !== -1 && closingIndex < searchEnd) {
      inlineRanges.push({ start: tickMatch.index, end: closingIndex + delimiter.length });
      ticksRegex.lastIndex = closingIndex + delimiter.length;
    }
  }

  return [...fencedRanges, ...inlineRanges].sort((a, b) => a.start - b.start);
}

export function getMarkdownProtectedRanges(markdown: string): TextRange[] {
  const ranges = getMarkdownCodeRanges(markdown);
  const commentRegex = /<!--[\s\S]*?(?:-->|$)/g;
  let match: RegExpExecArray | null;
  while ((match = commentRegex.exec(markdown)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }

  const sorted = ranges.sort((a, b) => a.start - b.start);
  const merged: TextRange[] = [];
  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

export function isIndexInRanges(index: number, ranges: TextRange[]): boolean {
  return ranges.some((range) => index >= range.start && index < range.end);
}

export function protectMarkdownCode(markdown: string): { content: string; restore: (value: string) => string } {
  const ranges = getMarkdownProtectedRanges(markdown);
  const segments: string[] = [];
  let cursor = 0;
  let content = '';

  ranges.forEach((range, index) => {
    content += markdown.slice(cursor, range.start);
    segments.push(markdown.slice(range.start, range.end));
    content += `\u0000CWP_CODE_${index}\u0000`;
    cursor = range.end;
  });
  content += markdown.slice(cursor);

  return {
    content,
    restore: (value: string) =>
      segments.reduce(
        (restored, segment, index) => restored.split(`\u0000CWP_CODE_${index}\u0000`).join(segment),
        value
      ),
  };
}
