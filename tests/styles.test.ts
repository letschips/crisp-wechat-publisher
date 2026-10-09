import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(process.cwd(), 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// A translucent Obsidian window (Baseline / Still + the translucent snippet) leaves ghost
// frames or blacks out the window around anything that gets its own GPU layer or samples
// the backdrop. The preview modal must stay on the plain compositing path.
test('styles.css never asks for a backdrop filter, a promoted layer or a 3D transform', () => {
  for (const pattern of [/backdrop-filter/, /will-change/, /translate3d|translateZ|perspective/]) {
    assert.equal(pattern.test(css), false, `styles.css must not contain ${pattern}`);
  }
});

// Theme and core `button` rules draw their own fill and inset ring; the inspector controls
// declare theirs with !important so the capsule/chip look survives every theme.
test('inspector controls reset the fill and ring that theme button rules add', () => {
  for (const selector of ['.cwp-segmented-item', '.cwp-color-chip']) {
    const rule = css.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
    assert.match(rule, /background:[^;]*!important/, `${selector} background`);
    assert.match(rule, /box-shadow:\s*none\s*!important/, `${selector} box-shadow`);
  }
});
