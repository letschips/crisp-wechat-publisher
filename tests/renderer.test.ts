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

test('slider callout renders wechat horizontal scrolling container with track and items', () => {
  const md = `> [!SLIDER] 向左滑动查看更多
> ![图1](https://example.com/1.png)
> ![图2](https://example.com/2.png)`;

  const { html } = parseAndRenderMarkdown(md, DEFAULT_SETTINGS);

  assert.match(html, /class="wechat-slider-container"/);
  assert.match(html, /class="wechat-slider-track"/);
  assert.match(html, /overflow-x:\s*auto/);
  assert.match(html, /white-space:\s*nowrap/);
  assert.match(html, /class="wechat-slider-item"/);
  assert.match(html, /data-ignore-width/);
  assert.match(html, /向左滑动查看更多/);
  assert.match(html, /https:\/\/example.com\/1.png/);
  assert.match(html, /https:\/\/example.com\/2.png/);

  // Inlining check
  const inlinedHtml = inlineWechatCSS(html, DEFAULT_SETTINGS);
  assert.match(inlinedHtml, /display:\s*inline-block;\s*width:\s*100%/);
  assert.match(inlinedHtml, /data-ignore-width/);
});

test('slider supports explicit slide separators with rich content', () => {
  const md = `> [!SLIDER]
> ![图1](https://example.com/1.png)
> **卡片1标题**
> ---
> ![图2](https://example.com/2.png)
> **卡片2标题**`;

  const { html } = parseAndRenderMarkdown(md, DEFAULT_SETTINGS);

  const itemCount = (html.match(/class="wechat-slider-item"/g) || []).length;
  assert.equal(itemCount, 2);
  assert.match(html, /<strong>卡片1标题<\/strong>/);
  assert.match(html, /<strong>卡片2标题<\/strong>/);
  assert.match(html, /向左滑动查看更多内容/);
});

test('expand callout renders native wechat details accordion', () => {
  const md = `> [!EXPAND] 点击查看完整代码配置
> \`\`\`bash
> echo "test"
> \`\`\``;

  const { html } = parseAndRenderMarkdown(md, DEFAULT_SETTINGS);

  assert.match(html, /<details class="wechat-details"/);
  assert.match(html, /<summary class="wechat-details-summary"/);
  assert.match(html, /点击查看完整代码配置/);
  assert.match(html, /<div class="wechat-details-content"/);
  assert.match(html, /class="hljs-built_in">echo<\/span>/);

  const inlinedHtml = inlineWechatCSS(html, DEFAULT_SETTINGS);
  assert.match(inlinedHtml, /border:\s*1px solid #e5e7eb/);
});

test('stat callout renders impactful number card', () => {
  const md = `> [!STAT] 2.6倍 | 正确补丁量提升
> Chrome 团队实测补丁产出率达到顶尖大模型的 2.6 倍。`;

  const { html } = parseAndRenderMarkdown(md, DEFAULT_SETTINGS);

  assert.match(html, /class="wechat-stat-card"/);
  assert.match(html, /class="wechat-stat-number"/);
  assert.match(html, /2\.6倍/);
  assert.match(html, /class="wechat-stat-label"/);
  assert.match(html, /正确补丁量提升/);
  assert.match(html, /class="wechat-stat-desc"/);
  assert.match(html, /Chrome 团队实测/);

  const inlinedHtml = inlineWechatCSS(html, DEFAULT_SETTINGS);
  assert.match(inlinedHtml, /font-size:\s*38px/);
});

test('TOC tag auto-extracts document H2 headings into guide card', () => {
  const md = `
# 主标题

[TOC]

## 1. 算力经济学转向
正文内容1

## 2. 端到端长任务实测
正文内容2
`;

  const { html } = parseAndRenderMarkdown(md, DEFAULT_SETTINGS);

  assert.match(html, /class="wechat-toc-card"/);
  assert.match(html, /本文核心脉络/);
  assert.match(html, /1\. 算力经济学转向/);
  assert.match(html, /2\. 端到端长任务实测/);

  const inlinedHtml = inlineWechatCSS(html, DEFAULT_SETTINGS);
  assert.match(inlinedHtml, /border-left:\s*4px solid/);
});

test('TOC tag ignores H2 headings inside fenced code blocks', () => {
  const md = `
# 主标题

[TOC]

## 真正的一节
正文1

\`\`\`markdown
## 这里的二级标题是代码示例！
\`\`\`

## 真正的二节
正文2
`;

  const { html } = parseAndRenderMarkdown(md, DEFAULT_SETTINGS);

  const tocCardHtml = html.match(/<section class="wechat-toc-card"[\s\S]*?<\/section>/)?.[0] || '';
  assert.match(tocCardHtml, /真正的一节/);
  assert.match(tocCardHtml, /真正的二节/);
  assert.doesNotMatch(tocCardHtml, /这里的二级标题是代码示例/);
});


test('stat card supports fullwidth bar and slash separators', () => {
  const md1 = `> [!STAT] 2.6倍 ｜ 全角测试说明
> 详细说明文字`;
  const { html: html1 } = parseAndRenderMarkdown(md1, DEFAULT_SETTINGS);
  assert.match(html1, /class="wechat-stat-number"[^>]*>\s*2\.6倍\s*<\/div>/);
  assert.match(html1, /class="wechat-stat-label"[^>]*>\s*全角测试说明\s*<\/div>/);

  const md2 = `> [!STAT] $0.75 / 百万Token
> 详细说明文字`;
  const { html: html2 } = parseAndRenderMarkdown(md2, DEFAULT_SETTINGS);
  assert.match(html2, /class="wechat-stat-number"[^>]*>\s*\$0\.75\s*<\/div>/);
  assert.match(html2, /class="wechat-stat-label"[^>]*>\s*百万Token\s*<\/div>/);
});

test('math formulas render as self-contained SVG that survives WeChat paste', () => {
  const formula = String.raw`$$\text{Intelligence} \times \text{Context} \xrightarrow{\text{搜索}} \text{Autonomy}$$

行内 $N \times M$ 公式`;
  const { html } = parseAndRenderMarkdown(formula, DEFAULT_SETTINGS);
  const inlinedHtml = inlineWechatCSS(html, DEFAULT_SETTINGS);

  assert.doesNotMatch(inlinedHtml, /katex|<annotation|<math|mjx-container|<use\b/);
  const svgs = inlinedHtml.match(/class="math-(?:block|inline)"[^>]*><svg\b[^>]*>/g) || [];
  assert.equal(svgs.length, 2);
  for (const svg of svgs) {
    assert.match(svg, /viewBox="/);
    assert.match(svg, /max-width:\s*100%/);
  }
  assert.match(inlinedHtml, /fill="currentColor"/);
  assert.match(inlinedHtml, /<section class="math-block"[^>]*text-align:\s*center/);
  assert.match(inlinedHtml, /<span class="math-inline"/);
});

test('dollar signs inside code are not rendered as math', () => {
  const md = '`echo $HOME $PATH`\n\n```sh\necho $HOME and $PATH\n```';
  const { html } = parseAndRenderMarkdown(md, DEFAULT_SETTINGS);
  assert.doesNotMatch(html, /<svg/);
  assert.match(html, /\$HOME \$PATH/);
  assert.match(html.replace(/<[^>]+>/g, ''), /echo \$HOME and \$PATH/);
});





test('code blocks wrap long lines so WeChat does not flag pre overflow on mobile', () => {
  const md = '```js\nconst veryLongLine = "' + 'x'.repeat(200) + '";\n```';
  for (const isMacCodeBlock of [true, false]) {
    const settings = { ...DEFAULT_SETTINGS, isMacCodeBlock };
    const inlinedHtml = inlineWechatCSS(parseAndRenderMarkdown(md, settings).html, settings);
    const preTags = inlinedHtml.match(/<pre\b[^>]*>/g) || [];
    assert.equal(preTags.length, 1, `mac=${isMacCodeBlock}`);
    assert.match(preTags[0], /white-space:\s*pre-wrap/, `mac=${isMacCodeBlock}`);
    assert.match(preTags[0], /word-break:\s*break-all/, `mac=${isMacCodeBlock}`);
  }
});

test('highlighted code tokens get inline colors that survive WeChat class stripping', () => {
  const md = '```js\n// note\nfunction hello() { return "hi"; }\n```';
  const inlinedHtml = inlineWechatCSS(parseAndRenderMarkdown(md, DEFAULT_SETTINGS).html, DEFAULT_SETTINGS);
  for (const cls of ['hljs-keyword', 'hljs-comment', 'hljs-string']) {
    assert.match(inlinedHtml, new RegExp(`<span class="${cls}"[^>]*style="[^"]*color:\\s*#`), cls);
  }
});

test('math alphabets that MathJax loads on demand still render offline', () => {
  const md = String.raw`$$\mathbb{R} \mathcal{L} \mathscr{F} \mathfrak{g} \mathsf{T} \mathtt{x} \ell \checkmark \text{café}$$`;
  const { html } = parseAndRenderMarkdown(md, DEFAULT_SETTINGS);
  assert.match(html, /<section class="math-block"[^>]*><svg/);
  assert.doesNotMatch(html, /\$\$/);
});
