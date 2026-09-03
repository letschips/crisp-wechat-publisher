import test from 'node:test';
import assert from 'node:assert/strict';
import { formatImage } from '../src/core/wechat-dom';

test('image markup escapes user-controlled URLs and captions', () => {
  const html = formatImage('https://example.com/a.png\" onerror=\"alert(1)', '<Hero & cover>');

  assert.match(html, /src="https:\/\/example\.com\/a\.png&quot; onerror=&quot;alert\(1\)"/);
  assert.match(html, /alt="&lt;Hero &amp; cover&gt;"/);
  assert.match(html, /<figcaption[^>]*>&lt;Hero &amp; cover&gt;<\/figcaption>/);
  assert.doesNotMatch(html, /<Hero/);
});
