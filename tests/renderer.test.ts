import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAndRenderMarkdown } from '../src/core/renderer';
import { inlineWechatCSS } from '../src/core/juice-inliner';
import { DEFAULT_SETTINGS } from '../src/types';

test('callout body keeps rendered Markdown emphasis', () => {
  const { html } = parseAndRenderMarkdown(
    `> [!WARNING]
> **Important truth**: body with **emphasis**.`,
    DEFAULT_SETTINGS
  );

  assert.match(html, /<strong>Important truth<\/strong>/);
  assert.match(html, /<strong>emphasis<\/strong>/);
  assert.doesNotMatch(html, /\*\*Important truth\*\*/);
});

test('bold list labels stay inline with following Chinese punctuation', () => {
  const { html } = parseAndRenderMarkdown(
    '* **痛点**：在浏览器和 Obsidian 之间反复切屏。',
    DEFAULT_SETTINGS
  );
  const inlinedHtml = inlineWechatCSS(html, DEFAULT_SETTINGS);

  assert.match(
    inlinedHtml,
    /<strong style="[^"]*display:\s*inline[^"]*">痛点<\/strong>：/
  );
});
