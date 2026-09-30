/**
 * 致谢 / Credits
 *
 * 本模块核心渲染逻辑改编自 doocs/md (https://github.com/doocs/md),
 * 一款开源的微信 Markdown 编辑器, 基于 WTFPL 许可证发布。
 * 感谢原作者的工作。
 *
 * Portions of this code are adapted from doocs/md (https://github.com/doocs/md),
 * an open-source WeChat Markdown editor released under the WTFPL license.
 */

import { Marked, Renderer as MarkedRenderer } from 'marked';
import hljs from 'highlight.js';
import katex from 'katex';
import type { PluginSettings } from '../types';
import {
  FootnoteItem,
  buildFootnotesHtml,
  formatImage,
  formatMacCodeBlock,
  formatWechatSlider,
  formatWechatDetails,
  formatWechatStat,
  formatWechatToc,
} from './wechat-dom';

export interface RenderResult {
  html: string;
  footnotes: FootnoteItem[];
}

const CALLOUT_ICONS: Record<string, { icon: string; title: string; color: string; bg: string }> = {
  note: { icon: 'ℹ️', title: 'Note', color: '#0969da', bg: '#f0f8ff' },
  info: { icon: 'ℹ️', title: 'Info', color: '#0969da', bg: '#f0f8ff' },
  tip: { icon: '💡', title: 'Tip', color: '#1a7f37', bg: '#f6fbf7' },
  important: { icon: '🟣', title: 'Important', color: '#8250df', bg: '#fbf7ff' },
  warning: { icon: '⚠️', title: 'Warning', color: '#9a6700', bg: '#fffdf5' },
  caution: { icon: '🛑', title: 'Caution', color: '#cf222e', bg: '#fff8f8' },
  danger: { icon: '⚡', title: 'Danger', color: '#cf222e', bg: '#fff8f8' },
  error: { icon: '❌', title: 'Error', color: '#cf222e', bg: '#fff8f8' },
  bug: { icon: '🪲', title: 'Bug', color: '#e5534b', bg: '#fff5f5' },
  abstract: { icon: '📋', title: 'Abstract', color: '#0090ff', bg: '#f0f9ff' },
  summary: { icon: '📋', title: 'Summary', color: '#0090ff', bg: '#f0f9ff' },
  tldr: { icon: '📌', title: 'TL;DR', color: '#0090ff', bg: '#f0f9ff' },
  todo: { icon: '☑️', title: 'Todo', color: '#0969da', bg: '#f0f8ff' },
  success: { icon: '✅', title: 'Success', color: '#1a7f37', bg: '#f6fbf7' },
  done: { icon: '✅', title: 'Done', color: '#1a7f37', bg: '#f6fbf7' },
  question: { icon: '❓', title: 'Question', color: '#d97706', bg: '#fffbeb' },
  help: { icon: '❓', title: 'Help', color: '#d97706', bg: '#fffbeb' },
  faq: { icon: '❓', title: 'FAQ', color: '#d97706', bg: '#fffbeb' },
  example: { icon: '📑', title: 'Example', color: '#7c3aed', bg: '#faf5ff' },
  quote: { icon: '💬', title: 'Quote', color: '#4b5563', bg: '#f9fafb' },
  cite: { icon: '💬', title: 'Cite', color: '#4b5563', bg: '#f9fafb' },
};

export function createWechatRenderer(
  settings: PluginSettings,
  documentHeadings: string[] = []
): { marked: Marked; getFootnotes: () => FootnoteItem[] } {
  const footnotes: FootnoteItem[] = [];
  let footnoteCounter = 0;

  const marked = new Marked();
  const renderer = new MarkedRenderer();

  // 1. Custom Code Block Highlighter
  renderer.code = function ({ text, lang }) {
    const language = lang && hljs.getLanguage(lang) ? lang : '';
    let highlighted: string;

    if (language) {
      try {
        highlighted = hljs.highlight(text, { language }).value;
      } catch {
        highlighted = hljs.highlightAuto(text).value;
      }
    } else {
      highlighted = hljs.highlightAuto(text).value;
    }

    if (settings.isMacCodeBlock) {
      return formatMacCodeBlock(highlighted, language);
    }

    return `<pre class="code__pre" style="margin: 1.5em 0; padding: 14px 16px; background: #282c34; color: #abb2bf; border-radius: 8px; overflow-x: auto; white-space: pre-wrap; word-break: break-all;"><code class="hljs ${language}">${highlighted}</code></pre>`;
  };

  // 2. Custom Image Renderer
  renderer.image = function ({ href, title, text }) {
    return formatImage(href, text || title || '');
  };

  // 3. Custom Link / Footnote Renderer
  renderer.link = function ({ href, title, text }) {
    const isExternal = href.startsWith('http://') || href.startsWith('https://');
    const isWechatInternal = href.startsWith('https://mp.weixin.qq.com');

    if (settings.citeStatus && isExternal && !isWechatInternal) {
      footnoteCounter++;
      const currentIdx = footnoteCounter;
      footnotes.push({
        index: currentIdx,
        title: text || title || href,
        link: href,
      });

      return `<span>${text}</span><sup style="color: var(--md-primary-color); font-size: 75%; font-weight: 600; vertical-align: super;">[${currentIdx}]</sup>`;
    }

    return `<a href="${href}" title="${title || ''}" target="_blank" rel="noopener noreferrer" style="color: var(--md-primary-color); text-decoration: none; border-bottom: 1px solid var(--md-primary-color);">${text}</a>`;
  };

  // 4. Custom Blockquote & Obsidian Callouts
  renderer.blockquote = function ({ text }) {
    // Check for callout syntax inside blockquote HTML
    // Marked often wraps inner content with <p> ... </p>
    const alertPattern = /^\s*(?:<p>)?\s*\[!([a-zA-Z0-9_-]+)\][ \t]*([^\n<]*)(?:<br\s*\/?>|\n)?([\s\S]*?)(?:<\/p>)?\s*$/i;
    const match = text.match(alertPattern);

    if (match) {
      const type = match[1].toLowerCase();
      const customTitle = match[2].trim();
      let body = match[3].trim();

      if (['slider', 'carousel', 'swiper', 'gallery'].includes(type)) {
        return renderWechatSliderBlock(body, customTitle, marked);
      }

      if (['expand', 'collapse', 'details', 'fold'].includes(type)) {
        const cleanBody = body.replace(/<\/p>\s*$/i, '').trim();
        const contentHtml = (marked.parse(cleanBody) as string).trim();
        return formatWechatDetails(customTitle, contentHtml);
      }

      if (['stat', 'stats', 'number', 'highlight'].includes(type)) {
        const cleanBody = body.replace(/<\/p>\s*$/i, '').trim();
        let numStr = customTitle;
        let lblStr = '';
        const sepMatch = customTitle.match(/\s*[|｜/]\s*/);
        if (sepMatch && sepMatch.index !== undefined) {
          numStr = customTitle.slice(0, sepMatch.index).trim();
          lblStr = customTitle.slice(sepMatch.index + sepMatch[0].length).trim();
        }
        const descHtml = (marked.parse(cleanBody) as string).trim();
        return formatWechatStat(numStr, lblStr, descHtml);
      }

      if (['toc', 'guide', 'outline'].includes(type)) {
        const cleanBody = body.replace(/<\/p>\s*$/i, '').trim();
        let items = cleanBody
          ? cleanBody.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
          : [];
        if (items.length === 0 && documentHeadings.length > 0) {
          items = documentHeadings;
        }
        return formatWechatToc(customTitle, items);
      }

      const config = CALLOUT_ICONS[type] || {
        icon: 'ℹ️',
        title: type.charAt(0).toUpperCase() + type.slice(1),
        color: '#0969da',
        bg: '#f0f8ff',
      };

      const displayTitle = customTitle || config.title;
      body = marked.parseInline(body) as string;

      return `
<section class="markdown-alert markdown-alert-${type}" style="margin: 1.5em 0; padding: 12px 16px; border-left: 4px solid ${config.color}; background: ${config.bg}; border-radius: 6px;">
  <div class="markdown-alert-title" style="display: flex; align-items: center; gap: 6px; font-weight: 600; color: ${config.color}; font-size: 14px; margin-bottom: 6px;">
    <span>${config.icon}</span>
    <span>${displayTitle}</span>
  </div>
  <div class="markdown-alert-content" style="color: #3f3f3f; font-size: 14px; line-height: 1.6;">${body}</div>
</section>`;
    }

    return `<blockquote style="margin: 1.5em 0; padding: 12px 16px; border-left: 4px solid var(--md-primary-color); background: #f7f7f7; border-radius: 6px; color: #555555;">${text}</blockquote>`;
  };

  // 5. Custom Codespan Renderer
  renderer.codespan = function ({ text }) {
    return `<code class="codespan" style="font-size: 88%; color: var(--md-primary-color); background: #f3f4f6; padding: 2px 6px; border-radius: 4px; margin: 0 2px; font-family: Menlo, Monaco, Consolas, monospace;">${text}</code>`;
  };

  // 6. Custom Table Renderer (Marked Token-based)
  renderer.table = function (token) {
    let headerHtml = '';
    if (token.header && token.header.length > 0) {
      let headerCells = '';
      for (const cell of token.header) {
        const cellContent = this.parser.parseInline(cell.tokens);
        const alignStyle = cell.align ? `text-align: ${cell.align};` : 'text-align: left;';
        headerCells += `<th style="background: var(--md-primary-color); color: #ffffff; padding: 10px 14px; font-weight: 600; border: 1px solid var(--md-primary-color); font-size: 13.5px; ${alignStyle}">${cellContent}</th>`;
      }
      headerHtml = `<thead><tr style="border-bottom: 2px solid var(--md-primary-color);">${headerCells}</tr></thead>`;
    }

    let bodyHtml = '';
    if (token.rows && token.rows.length > 0) {
      let rowsContent = '';
      token.rows.forEach((row, rIdx) => {
        let rowCells = '';
        const bg = rIdx % 2 === 1 ? 'background: #fbfbfb;' : 'background: #ffffff;';
        for (const cell of row) {
          const cellContent = this.parser.parseInline(cell.tokens);
          const alignStyle = cell.align ? `text-align: ${cell.align};` : 'text-align: left;';
          rowCells += `<td style="padding: 10px 14px; border: 1px solid #e5e7eb; color: #3f3f3f; font-size: 13px; line-height: 1.6; ${alignStyle}">${cellContent}</td>`;
        }
        rowsContent += `<tr style="${bg}">${rowCells}</tr>`;
      });
      bodyHtml = `<tbody>${rowsContent}</tbody>`;
    }

    return `
<section class="table-container" data-ignore-width="" style="margin: 1.8em 0; overflow-x: auto;">
  <table style="width: 100%; border-collapse: collapse; border-spacing: 0; margin: 0; font-size: 13.5px; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);">
    ${headerHtml}
    ${bodyHtml}
  </table>
</section>`;
  };

  marked.use({ renderer });

  return {
    marked,
    getFootnotes: () => footnotes,
  };
}

export function parseAndRenderMarkdown(markdown: string, settings: PluginSettings): RenderResult {
  let processed = markdown;

  // 1. Ruby Annotation Parser: [文字]{注音} or [文字]^(注音)
  processed = processed.replace(/\[([^\]]+)\]\{([^}]+)\}/g, '<ruby>$1<rp>(</rp><rt style="font-size: 0.75em; color: var(--md-primary-color);">$2</rt><rp>)</rp></ruby>');
  processed = processed.replace(/\[([^\]]+)\]\^\(([^)]+)\)/g, '<ruby>$1<rp>(</rp><rt style="font-size: 0.75em; color: var(--md-primary-color);">$2</rt><rp>)</rp></ruby>');

  // 2. Block math: $$ ... $$
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
    try {
      return `<section class="katex-block" data-ignore-width="" style="text-align: center; margin: 1.5em 0; overflow-x: auto;">${katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false, output: 'html' })}</section>`;
    } catch {
      return match;
    }
  });

  // 3. Inline math: $ ... $
  processed = processed.replace(/(?<!\\)\$([^\$\n]+?)\$/g, (match, formula) => {
    try {
      return `<span class="katex-inline">${katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false, output: 'html' })}</span>`;
    } catch {
      return match;
    }
  });

  // 4. Collect document H2 headings for TOC (strip code blocks to avoid code sample pollution)
  const documentHeadings: string[] = [];
  const textWithoutCode = processed
    .replace(/^ {0,3}```[\s\S]*?```$/gm, '')
    .replace(/`[^`\n]+`/g, '');
  const headingLines = textWithoutCode.split(/\r?\n/);
  for (const line of headingLines) {
    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      const cleanText = h2Match[1]
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .trim();
      documentHeadings.push(cleanText);
    }
  }

  // 5. Expand standalone [TOC] tags via placeholder to prevent marked from parsing inner HTML as indented code blocks
  let tocCardHtml = '';
  const tocRegex = /^[ \t]*(?:\[TOC\]|\{:toc\}|<!--\s*toc\s*-->)[ \t]*$/gim;
  if (tocRegex.test(processed)) {
    tocCardHtml = formatWechatToc('本文核心脉络', documentHeadings);
    processed = processed.replace(tocRegex, () => '\n\u0000CWP_TOC_PLACEHOLDER\u0000\n');
  }

  const { marked, getFootnotes } = createWechatRenderer(settings, documentHeadings);
  const rawHtml = marked.parse(processed) as string;
  const footnotes = getFootnotes();

  let finalHtml = rawHtml;
  if (tocCardHtml) {
    finalHtml = finalHtml.replace(/<p>\s*\u0000CWP_TOC_PLACEHOLDER\u0000\s*<\/p>/g, tocCardHtml);
    finalHtml = finalHtml.split('\u0000CWP_TOC_PLACEHOLDER\u0000').join(tocCardHtml);
  }

  if (footnotes.length > 0) {
    finalHtml += buildFootnotesHtml(footnotes);
  }


  return {
    html: finalHtml,
    footnotes,
  };
}

function renderWechatSliderBlock(body: string, hintText: string, markedInstance: Marked): string {
  const cleanBody = body.replace(/<\/p>\s*$/i, '').trim();

  // 1. Check for explicit slide separators: ---, ***, ___, or <!-- slide -->
  const sepRegex = /(?:^|\n)[ \t]*(?:---|___|\*\*\*|<!--\s*slide\s*-->)[ \t]*(?:\n|$)/i;
  let slideRawParts: string[] = [];

  if (sepRegex.test(cleanBody)) {
    slideRawParts = cleanBody.split(sepRegex).map((s) => s.trim()).filter(Boolean);
  } else {
    // 2. Split by individual images (markdown, html, or figure)
    const lines = cleanBody.split(/\r?\n/);
    let currentSlide: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      const isNewImage = /^(!\[|<img|<figure)/i.test(trimmed);
      if (isNewImage && currentSlide.length > 0) {
        slideRawParts.push(currentSlide.join('\n').trim());
        currentSlide = [line];
      } else {
        currentSlide.push(line);
      }
    }
    if (currentSlide.length > 0) {
      const lastChunk = currentSlide.join('\n').trim();
      if (lastChunk) slideRawParts.push(lastChunk);
    }
  }

  if (slideRawParts.length === 0 && cleanBody) {
    slideRawParts = [cleanBody];
  }

  const slidesHtml = slideRawParts.map((raw) => {
    return (markedInstance.parse(raw) as string).trim();
  });

  return formatWechatSlider(slidesHtml, hintText);
}

