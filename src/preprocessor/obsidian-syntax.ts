import type { ThemeName } from '../types';
import { protectMarkdownCode } from '../core/markdown-context';

export interface PreprocessResult {
  content: string;
  frontmatter: Record<string, any>;
  themeOverride?: ThemeName;
  primaryColorOverride?: string;
  fontSizeOverride?: string;
  citeStatusOverride?: boolean;
}

export function parseFrontmatter(markdown: string): { frontmatter: Record<string, any>; content: string } {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
  const match = markdown.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, content: markdown };
  }

  const rawYaml = match[1];
  const content = markdown.slice(match[0].length);
  const frontmatter: Record<string, any> = {};

  const lines = rawYaml.split(/\r?\n/);
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex !== -1 && !line.trim().startsWith('#') && !line.trim().startsWith('-')) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      frontmatter[key] = value;
    }
  }

  return { frontmatter, content };
}

export function transformObsidianSyntax(markdown: string): PreprocessResult {
  const { frontmatter, content: rawContent } = parseFrontmatter(markdown);

  // 0. Transform component code blocks (```slider, ```expand, ```stat, ```toc) into callout syntax
  const componentBlockRegex = /^ {0,3}```(slider|carousel|swiper|gallery|expand|details|collapse|fold|stat|stats|number|highlight|toc|guide|outline)[ \t]*(.*)\r?\n([\s\S]*?)\r?\n {0,3}```$/gim;
  const normalizedRaw = rawContent.replace(componentBlockRegex, (_match, rawType, title, inner) => {
    const typeLower = rawType.toLowerCase();
    let calloutType = 'SLIDER';
    if (['expand', 'details', 'collapse', 'fold'].includes(typeLower)) calloutType = 'EXPAND';
    else if (['stat', 'stats', 'number', 'highlight'].includes(typeLower)) calloutType = 'STAT';
    else if (['toc', 'guide', 'outline'].includes(typeLower)) calloutType = 'TOC';

    const cleanTitle = title ? title.trim() : '';
    const header = cleanTitle ? `> [!${calloutType}] ${cleanTitle}` : `> [!${calloutType}]`;
    const lines = inner.split(/\r?\n/).map((line: string) => `> ${line}`);
    return `${header}\n${lines.join('\n')}`;
  });


  const protectedCode = protectMarkdownCode(normalizedRaw);
  let content = protectedCode.content;

  // 1. Remove Obsidian Comments: %% comment %%
  content = content.replace(/%%[\s\S]*?%%/g, '');

  // 2. Obsidian Highlights: ==highlight== -> <mark>highlight</mark>
  content = content.replace(/==([^=\n]+)==/g, '<mark style="background: rgba(255, 225, 0, 0.4); padding: 2px 4px; border-radius: 3px; color: inherit;">$1</mark>');

  // 3. Transform Obsidian Callouts: > [!NOTE]+ Title or > [!NOTE]- Title or > [!NOTE]
  content = content.replace(/^>\s*\[!([a-zA-Z0-9_-]+)\][+-]?[ \t]*(.*)$/gm, (match, type, title) => {
    const cleanType = type.trim();
    if (title && title.trim()) {
      return `> [!${cleanType.toUpperCase()}] ${title.trim()}`;
    }
    return `> [!${cleanType.toUpperCase()}]`;
  });

  // 4. Clean Obsidian Internal Wikilinks (Non-images): [[Target|Alias]] -> Alias, [[Target]] -> Target
  content = content.replace(/(?<!\!)\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (match, target, alias) => {
    return alias ? alias.trim() : target.trim();
  });

  // 5. Extract Theme Overrides from frontmatter
  let themeOverride: ThemeName | undefined;
  if (frontmatter.theme && ['default', 'grace', 'simple'].includes(frontmatter.theme)) {
    themeOverride = frontmatter.theme as ThemeName;
  }

  let primaryColorOverride: string | undefined;
  const requestedColor = frontmatter.primaryColor || frontmatter.themeColor || frontmatter.color;
  if (typeof requestedColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(requestedColor)) {
    primaryColorOverride = requestedColor;
  }

  let fontSizeOverride: string | undefined;
  if (typeof frontmatter.fontSize === 'string' && /^(?:1[2-9]|2[0-4])px$/.test(frontmatter.fontSize)) {
    fontSizeOverride = frontmatter.fontSize;
  }

  let citeStatusOverride: boolean | undefined;
  if (frontmatter.citeStatus !== undefined) {
    citeStatusOverride = frontmatter.citeStatus === 'true' || frontmatter.citeStatus === true;
  }

  return {
    content: protectedCode.restore(content),
    frontmatter,
    themeOverride,
    primaryColorOverride,
    fontSizeOverride,
    citeStatusOverride,
  };
}
