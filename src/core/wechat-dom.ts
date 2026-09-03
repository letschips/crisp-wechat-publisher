export interface FootnoteItem {
  index: number;
  title: string;
  link: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildFootnotesHtml(footnotes: FootnoteItem[]): string {
  if (footnotes.length === 0) return '';

  const items = footnotes
    .map(
      (f) =>
        `<div style="margin: 4px 0; line-height: 1.5; word-break: break-all;"><span style="font-size: 85%; color: #888888; font-family: monospace;">[${f.index}]</span> <span style="font-weight: 500;">${f.title}</span>: <em style="color: #576b95;">${f.link}</em></div>`
    )
    .join('\n');

  return `
<section class="footnotes-container" style="margin-top: 3em; padding-top: 1.5em; border-top: 1px dashed #d1d5db; font-size: 13px; color: #6b7280;">
  <div class="footnotes-header" style="font-weight: 600; margin-bottom: 0.8em; color: #374151;">引用链接与参考资料：</div>
  ${items}
</section>`;
}

export function formatMacCodeBlock(codeHtml: string, lang: string = ''): string {
  const dots = `
<div class="mac-header" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; background: #21252b; border-top-left-radius: 8px; border-top-right-radius: 8px; user-select: none;">
  <div style="display: flex; gap: 6px;">
    <span style="width: 11px; height: 11px; border-radius: 50%; background: #ff5f56; display: inline-block;"></span>
    <span style="width: 11px; height: 11px; border-radius: 50%; background: #ffbd2e; display: inline-block;"></span>
    <span style="width: 11px; height: 11px; border-radius: 50%; background: #27c93f; display: inline-block;"></span>
  </div>
  <span style="font-size: 11px; color: #abb2bf; text-transform: uppercase; font-family: monospace;">${lang || 'CODE'}</span>
</div>`;

  return `
<div class="code-wrapper" style="margin: 1.5em 0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
  ${dots}
  <pre class="code__pre" style="margin: 0; padding: 14px 16px; background: #282c34; color: #abb2bf; overflow-x: auto; border-top-left-radius: 0; border-top-right-radius: 0; font-family: Menlo, Monaco, Consolas, 'Courier New', monospace; font-size: 13px; line-height: 1.55;">${codeHtml}</pre>
</div>`;
}

export function formatImage(src: string, alt: string): string {
  const cleanAlt = alt ? alt.trim() : '';
  const escapedAlt = escapeHtml(cleanAlt);
  const escapedSrc = escapeHtml(src);
  const imgTag = `<img src="${escapedSrc}" alt="${escapedAlt}" style="display: block; max-width: 100%; height: auto; margin: 1.5em auto; border-radius: 8px;" />`;

  if (cleanAlt) {
    return `
<figure style="margin: 1.5em auto; text-align: center;">
  ${imgTag}
  <figcaption class="md-figcaption" style="text-align: center; color: #888888; font-size: 13px; margin-top: -0.8em; margin-bottom: 1em;">${escapedAlt}</figcaption>
</figure>`;
  }

  return imgTag;
}
