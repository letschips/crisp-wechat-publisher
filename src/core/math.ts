import { mathjax } from '@mathjax/src/mjs/mathjax.js';
import { TeX } from '@mathjax/src/mjs/input/tex.js';
import { SVG } from '@mathjax/src/mjs/output/svg.js';
import { liteAdaptor, LiteAdaptor } from '@mathjax/src/mjs/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from '@mathjax/src/mjs/handlers/html.js';
import '@mathjax/src/mjs/input/tex/base/BaseConfiguration.js';
import '@mathjax/src/mjs/input/tex/ams/AmsConfiguration.js';
import '@mathjax/src/mjs/input/tex/newcommand/NewcommandConfiguration.js';
import '@mathjax/src/mjs/input/tex/noundefined/NoUndefinedConfiguration.js';
import { MathJaxNewcmFont } from '@mathjax/mathjax-newcm-font/mjs/svg.js';
// Font ranges MathJax would normally fetch on demand; bundled because the plugin
// cannot load files at runtime (\mathbb, \mathcal, \mathscr, \mathfrak, \mathsf,
// \mathtt, \ell/\Re/\checkmark, accented Latin in \text{}).
import '@mathjax/mathjax-newcm-font/mjs/svg/dynamic/double-struck.js';
import '@mathjax/mathjax-newcm-font/mjs/svg/dynamic/calligraphic.js';
import '@mathjax/mathjax-newcm-font/mjs/svg/dynamic/script.js';
import '@mathjax/mathjax-newcm-font/mjs/svg/dynamic/fraktur.js';
import '@mathjax/mathjax-newcm-font/mjs/svg/dynamic/sans-serif.js';
import '@mathjax/mathjax-newcm-font/mjs/svg/dynamic/monospace.js';
import '@mathjax/mathjax-newcm-font/mjs/svg/dynamic/shapes.js';
import '@mathjax/mathjax-newcm-font/mjs/svg/dynamic/latin.js';

const BUNDLED_DYNAMIC_FONTS = [
  'double-struck',
  'calligraphic',
  'script',
  'fraktur',
  'sans-serif',
  'monospace',
  'shapes',
  'latin',
];

/**
 * TeX → self-contained SVG.
 *
 * The WeChat editor rewrites pasted HTML and drops the CSS/fonts that KaTeX's
 * HTML layout depends on (inline-block + min-content + nowrap), which collapses
 * formulas into one-character-wide columns. SVG paths need no fonts or layout
 * CSS, and `fontCache: 'none'` avoids <defs>/<use> references WeChat may strip.
 * Long display formulas are line-broken for a phone-width column instead of
 * being scaled down to an unreadable size.
 */

// WeChat article column on a 375pt phone is ~343px; leave a little slack.
const PHONE_CONTAINER_WIDTH = 330;

let adaptor: LiteAdaptor | null = null;
let doc: ReturnType<typeof mathjax.document> | null = null;

function getDocument() {
  if (!doc) {
    adaptor = liteAdaptor();
    RegisterHTMLHandler(adaptor);
    doc = mathjax.document('', {
      InputJax: new TeX({ packages: ['base', 'ams', 'newcommand', 'noundefined'] }),
      OutputJax: new SVG({
        fontCache: 'none',
        fontData: MathJaxNewcmFont,
        displayOverflow: 'linebreak',
        linebreaks: { inline: false, width: '100%' },
      }),
    });
    const font = (doc.outputJax as any).font;
    for (const name of BUNDLED_DYNAMIC_FONTS) {
      font.CLASS.dynamicFiles[name].setup(font);
    }
  }
  return doc;
}

export function renderMathSvg(tex: string, display: boolean): string {
  const node = getDocument().convert(tex, {
    display,
    containerWidth: PHONE_CONTAINER_WIDTH,
    em: 16,
    ex: 8,
  });
  const svg = adaptor!.firstChild(node) as any;
  const style = (adaptor!.getAttribute(svg, 'style') || '').trim();
  // Safety net for very narrow screens; viewBox keeps the aspect ratio.
  adaptor!.setAttribute(svg, 'style', `${style}${style && !style.endsWith(';') ? ';' : ''} max-width: 100%; height: auto;`.trim());
  adaptor!.removeAttribute(svg, 'focusable');
  return adaptor!.outerHTML(svg);
}
