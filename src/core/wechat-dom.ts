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
<div class="code-wrapper" data-ignore-width="" style="margin: 1.5em 0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
  ${dots}
  <pre class="code__pre" data-ignore-width="" style="margin: 0; padding: 14px 16px; background: #282c34; color: #abb2bf; overflow-x: auto; border-top-left-radius: 0; border-top-right-radius: 0; font-family: Menlo, Monaco, Consolas, 'Courier New', monospace; font-size: 13px; line-height: 1.55; white-space: pre-wrap; word-break: break-all;">${codeHtml}</pre>
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

export function formatWechatSlider(slidesHtml: string[], hintText: string = ''): string {
  if (slidesHtml.length === 0) return '';

  const displayHint = hintText && hintText.trim()
    ? `${escapeHtml(hintText.trim())} &lt;&lt;&lt;`
    : '向左滑动查看更多内容 &lt;&lt;&lt;';

  const itemsHtml = slidesHtml
    .map(
      (content) =>
        `<section class="wechat-slider-item" data-ignore-width="" style="display: inline-block; width: 100%; vertical-align: top; white-space: normal; box-sizing: border-box; padding: 0 4px; scroll-snap-align: center;">${content.trim().replace(/<p>\s*<\/p>/g, '')}</section>`
    )
    .join('');

  return `<section class="wechat-slider-container" data-ignore-width="" style="margin: 1.8em 0; text-align: center; box-sizing: border-box;"><section class="wechat-slider-track" data-ignore-width="" style="overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; white-space: nowrap; font-size: 0; box-sizing: border-box; text-align: left; padding: 0; scrollbar-width: none; scroll-snap-type: x mandatory;">${itemsHtml}</section><p class="wechat-slider-hint" style="text-align: center; font-size: 12px; color: #999999; margin: 10px 0 0 0; letter-spacing: 0.5px; user-select: none;">${displayHint}</p></section>`;
}


export function formatWechatDetails(title: string, contentHtml: string): string {
  const cleanTitle = title && title.trim() ? escapeHtml(title.trim()) : '点击展开查看详情';
  return `<details class="wechat-details" style="margin: 1.5em 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background: #fafafa;"><summary class="wechat-details-summary" style="padding: 10px 14px; font-size: 14px; font-weight: 600; color: #374151; cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between; background: #f3f4f6; user-select: none;"><span>${cleanTitle}</span><span class="wechat-details-arrow" style="font-size: 11px; color: #9ca3af;">▼</span></summary><div class="wechat-details-content" style="padding: 12px 14px; background: #ffffff; font-size: 14px; line-height: 1.6; color: #3f3f3f; border-top: 1px solid #e5e7eb;">${contentHtml.trim()}</div></details>`;
}

export function formatWechatStat(numberStr: string, labelStr: string, descHtml: string): string {
  const cleanNumber = escapeHtml(numberStr.trim());
  const cleanLabel = labelStr && labelStr.trim() ? escapeHtml(labelStr.trim()) : '';
  const labelHtml = cleanLabel
    ? `<div class="wechat-stat-label" style="font-size: 12.5px; font-weight: 600; color: #64748b; margin-top: 4px; letter-spacing: 0.5px;">${cleanLabel}</div>`
    : '';

  return `<section class="wechat-stat-card" style="margin: 1.8em auto; text-align: center; padding: 22px 18px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; max-width: 92%; box-sizing: border-box;"><div class="wechat-stat-number" style="font-size: 38px; font-weight: 800; line-height: 1.1; color: var(--md-primary-color); letter-spacing: -0.5px;">${cleanNumber}</div>${labelHtml}<div class="wechat-stat-desc" style="font-size: 13.5px; color: #475569; margin-top: 8px; line-height: 1.55; text-align: center;">${descHtml.trim()}</div></section>`;
}

export function formatWechatToc(title: string, items: string[]): string {
  const cleanTitle = title && title.trim() ? escapeHtml(title.trim()) : '本文核心脉络';
  const itemsHtml = items
    .map((item, idx) => {
      const cleanItem = item.trim().replace(/^[-*•\d.]+\s*/, '');
      const escaped = escapeHtml(cleanItem);
      return `<div class="wechat-toc-item" style="display: flex; align-items: baseline; gap: 10px; font-size: 13.5px; line-height: 1.5; color: #4b5563; margin: 3px 0;"><span class="wechat-toc-badge" style="display: inline-block; width: 18px; height: 18px; line-height: 18px; text-align: center; font-size: 11px; font-weight: 700; border-radius: 50%; background: #e0f2fe; color: var(--md-primary-color); flex-shrink: 0;">${idx + 1}</span><span style="font-weight: 500;">${escaped}</span></div>`;
    })
    .join('');

  return `<section class="wechat-toc-card" style="margin: 2em auto; padding: 18px 20px; border-radius: 12px; background: #f9fafb; border-left: 4px solid var(--md-primary-color); box-shadow: 0 1px 3px rgba(0,0,0,0.03); box-sizing: border-box;"><div class="wechat-toc-header" style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14.5px; color: #1f2937; margin-bottom: 12px;"><span>🧭</span><span>${cleanTitle}</span></div><div class="wechat-toc-list" style="display: flex; flex-direction: column; gap: 6px;">${itemsHtml}</div></section>`;
}



