import type { ThemeName } from '../types';

export const BASE_CSS = `
/* ==================== Base Container ==================== */
section,
#output .container {
  font-family: var(--md-font-family);
  font-size: var(--md-font-size);
  line-height: 1.75;
  text-align: left;
}

#output {
  font-family: var(--md-font-family);
  font-size: var(--md-font-size);
  line-height: 1.75;
  text-align: left;
}

#output section > :first-child {
  margin-top: 0 !important;
}

#output strong,
#output b {
  display: inline;
  font-weight: 700;
}

#output blockquote,
section blockquote {
  margin-left: 0;
  margin-right: 0;
  margin-top: 0;
}

#output table,
section table {
  border-collapse: collapse;
  min-width: 100%;
}
`;

export const DEFAULT_CSS = `
/* ==================== H1 ==================== */
h1 {
  display: table;
  padding: 0 1em;
  border-bottom: 2px solid var(--md-primary-color);
  margin: 2em auto 1em;
  color: #3f3f3f;
  font-size: calc(var(--md-font-size) * 1.2);
  font-weight: bold;
  text-align: center;
}

/* ==================== H2 ==================== */
h2 {
  display: table;
  padding: 0 0.2em;
  margin: 3em auto 1.5em;
  color: #fff;
  background: var(--md-primary-color);
  font-size: calc(var(--md-font-size) * 1.2);
  font-weight: bold;
  text-align: center;
}

/* ==================== H3 ==================== */
h3 {
  padding-left: 8px;
  border-left: 3px solid var(--md-primary-color);
  margin: 2em 8px 0.75em 0;
  color: #3f3f3f;
  font-size: calc(var(--md-font-size) * 1.1);
  font-weight: bold;
  line-height: 1.2;
}

/* ==================== H4 ==================== */
h4 {
  margin: 2em 8px 0.5em;
  color: var(--md-primary-color);
  font-size: calc(var(--md-font-size) * 1);
  font-weight: bold;
}

/* ==================== Paragraph ==================== */
p {
  margin: 1.5em 8px;
  letter-spacing: 0.05em;
  color: #3f3f3f;
}

/* ==================== Blockquote ==================== */
blockquote {
  font-style: normal;
  padding: 1em;
  border-left: 4px solid var(--md-primary-color);
  border-radius: 6px;
  color: #555555;
  background: #f7f7f7;
  margin-bottom: 1em;
}

blockquote > p {
  display: block;
  font-size: 1em;
  letter-spacing: 0.05em;
  color: #555555;
  margin: 0;
}

/* ==================== GFM alerts ==================== */
.markdown-alert {
  padding: 0.8em 1em;
  margin-bottom: 1em;
  border-left: 4px solid #0969da;
  border-radius: 6px;
  background: #f6f8fa;
}

.markdown-alert-title {
  display: flex;
  align-items: center;
  font-weight: 600;
  margin-bottom: 4px;
}

.markdown-alert-note {
  border-left-color: #0969da;
  background: #f0f8ff;
}
.markdown-alert-tip {
  border-left-color: #1a7f37;
  background: #f6fbf7;
}
.markdown-alert-important {
  border-left-color: #8250df;
  background: #fbf7ff;
}
.markdown-alert-warning {
  border-left-color: #9a6700;
  background: #fffdf5;
}
.markdown-alert-caution {
  border-left-color: #cf222e;
  background: #fff8f8;
}

/* ==================== Code blocks ==================== */
pre.code__pre {
  margin: 1.5em 0;
  border-radius: 8px;
  background: #282c34;
  color: #abb2bf;
  padding: 12px 16px;
  overflow-x: auto;
  font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
  font-size: 0.9em;
  line-height: 1.5;
}

pre.code__pre code {
  font-family: inherit;
  font-size: inherit;
}

/* ==================== Inline code ==================== */
.codespan, code:not(pre code) {
  font-size: 0.9em;
  color: var(--md-primary-color);
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
  margin: 0 2px;
  font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
}

/* ==================== Images ==================== */
img {
  display: block;
  max-width: 100%;
  margin: 1.5em auto;
  border-radius: 8px;
}

figcaption,
.md-figcaption {
  text-align: center;
  color: #888888;
  font-size: 0.85em;
  margin-top: -1em;
  margin-bottom: 1.5em;
}

/* ==================== Lists ==================== */
ol {
  padding-left: 1.5em;
  margin: 1em 8px;
}

ul {
  padding-left: 1.5em;
  margin: 1em 8px;
}

li {
  margin: 0.5em 0;
  color: #3f3f3f;
}

/* ==================== Horizontal rules ==================== */
hr {
  height: 1px;
  border: none;
  margin: 2em 0;
  background: #e5e7eb;
}

/* ==================== Tables ==================== */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5em 0;
  font-size: 0.95em;
}

table th {
  background: var(--md-primary-color);
  color: #ffffff;
  padding: 8px 12px;
  font-weight: 600;
  border: 1px solid var(--md-primary-color);
  text-align: left;
}

table td {
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  color: #3f3f3f;
}

table tr:nth-child(even) {
  background: #f9fafb;
}

/* ==================== Links ==================== */
a {
  color: var(--md-primary-color);
  text-decoration: none;
  border-bottom: 1px solid var(--md-primary-color);
}

/* ==================== Footnotes ==================== */
.footnotes-container {
  margin-top: 3em;
  padding-top: 1.5em;
  border-top: 1px dashed #cccccc;
  font-size: 0.85em;
  color: #666666;
}

.footnotes-header {
  font-weight: bold;
  margin-bottom: 0.8em;
  color: #333333;
}
`;

export const GRACE_CSS = `
${DEFAULT_CSS}

/* Grace refinements */
h1 {
  padding: 0.5em 1em;
  font-size: calc(var(--md-font-size) * 1.35);
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

h2 {
  padding: 0.3em 1em;
  border-radius: 8px;
  font-size: calc(var(--md-font-size) * 1.25);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.08);
}

h3 {
  padding-left: 12px;
  font-size: calc(var(--md-font-size) * 1.15);
  border-left: 4px solid var(--md-primary-color);
  border-bottom: 1px dashed var(--md-primary-color);
}

blockquote {
  font-style: italic;
  padding: 1em 1em 1em 1.5em;
  border-left: 4px solid var(--md-primary-color);
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
}

img {
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
`;

export const SIMPLE_CSS = `
${DEFAULT_CSS}

/* Simple minimal refinements */
h1 {
  padding: 0.5em 1em;
  font-size: calc(var(--md-font-size) * 1.35);
}

h2 {
  padding: 0.3em 1.2em;
  font-size: calc(var(--md-font-size) * 1.25);
  border-radius: 8px 24px 8px 24px;
}

h3 {
  padding-left: 12px;
  font-size: calc(var(--md-font-size) * 1.15);
  border-radius: 6px;
  border-left: 4px solid var(--md-primary-color);
  background: rgba(15, 76, 129, 0.05);
}

blockquote {
  font-style: italic;
  padding: 1em;
  border-left: 3px solid var(--md-primary-color);
  background: #fafafa;
}
`;

export function getThemeCSS(theme: ThemeName): string {
  switch (theme) {
    case 'grace':
      return GRACE_CSS;
    case 'simple':
      return SIMPLE_CSS;
    case 'default':
    default:
      return DEFAULT_CSS;
  }
}
