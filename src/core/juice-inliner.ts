import juice from 'juice';
import type { PluginSettings, ThemeName } from '../types';
import { BASE_CSS, getThemeCSS } from './themes';

export interface RenderOverrides {
  theme?: ThemeName;
  primaryColor?: string;
  fontFamily?: string;
  fontSize?: string;
  citeStatus?: boolean;
  isMacCodeBlock?: boolean;
  isUseIndent?: boolean;
  isUseJustify?: boolean;
}

export function inlineWechatCSS(
  html: string,
  settings: PluginSettings,
  overrides?: RenderOverrides
): string {
  const effectiveTheme = overrides?.theme || settings.theme;
  const effectiveColor = overrides?.primaryColor || settings.primaryColor;
  const effectiveFont = overrides?.fontFamily || settings.fontFamily;
  const effectiveSize = overrides?.fontSize || settings.fontSize || '15px';
  const effectiveIndent = overrides?.isUseIndent !== undefined ? overrides.isUseIndent : settings.isUseIndent;
  const effectiveJustify = overrides?.isUseJustify !== undefined ? overrides.isUseJustify : settings.isUseJustify;

  const themeCss = getThemeCSS(effectiveTheme);

  let extraRules = '';
  if (effectiveIndent) {
    extraRules += '\n#output p, section p { text-indent: 2em; }\n';
  }
  if (effectiveJustify) {
    extraRules += '\n#output p, section p { text-align: justify; text-justify: inter-ideograph; }\n';
  }

  // Combine CSS rules
  let mergedCss = `
${BASE_CSS}
${themeCss}
${extraRules}
${settings.customCSS || ''}
`;

  // Pre-resolve CSS variables directly in CSS string so Juice can parse them
  mergedCss = mergedCss
    .replace(/var\(--md-primary-color\)/g, effectiveColor)
    .replace(/var\(--md-font-size\)/g, effectiveSize)
    .replace(/var\(--md-font-family\)/g, effectiveFont)
    .replace(/var\(--blockquote-background\)/g, '#f7f7f7')
    .replace(/hsl\(var\(--foreground\)\)/g, '#3f3f3f');

  // Wrap inside container section
  const wrappedHtml = `
  <section id="output">
  <style>
    ${mergedCss}
  </style>
  <div class="container">
    ${html}
  </div>
</section>
`;

  // Execute juice inline CSS
  let inlined = '';
  try {
    inlined = juice(wrappedHtml, {
      inlinePseudoElements: true,
      preserveImportant: true,
      resolveCSSVariables: false,
    });
  } catch (err) {
    console.warn('[Crisp WeChat] Juice inline CSS primary failed, falling back to simple options', err);
    try {
      inlined = juice(wrappedHtml, {
        inlinePseudoElements: false,
        preserveImportant: true,
      });
    } catch (err2) {
      console.error('[Crisp WeChat] Juice failed completely:', err2);
      inlined = wrappedHtml;
    }
  }

  // Post-processing inline styles for WeChat compatibility
  inlined = inlined
    .replace(/var\(--md-primary-color\)/g, effectiveColor)
    .replace(/var\(--md-font-size\)/g, effectiveSize)
    .replace(/var\(--md-font-family\)/g, effectiveFont)
    .replace(/--md-primary-color:[^;]+;/g, '')
    .replace(/--md-font-size:[^;]+;/g, '')
    .replace(/--md-font-family:[^;]+;/g, '');

  return inlined;
}
