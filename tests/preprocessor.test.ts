import test from 'node:test';
import assert from 'node:assert/strict';
import { transformObsidianSyntax } from '../src/preprocessor/obsidian-syntax';
import {
  extractImages,
  findTargetTFile,
  resolveAndUploadImages,
} from '../src/preprocessor/image-resolver';
import { DEFAULT_SETTINGS } from '../src/types';
import { TFile } from 'obsidian';

test('frontmatter exposes every per-note rendering override written by the preview', () => {
  const result = transformObsidianSyntax(`---
theme: grace
primaryColor: "#123456"
fontSize: 18px
citeStatus: false
---
Body`);

  assert.equal(result.themeOverride, 'grace');
  assert.equal(result.primaryColorOverride, '#123456');
  assert.equal((result as { fontSizeOverride?: string }).fontSizeOverride, '18px');
  assert.equal(result.citeStatusOverride, false);
});

test('wiki image embeds preserve both alt text and width', () => {
  assert.deepEqual(extractImages('![[assets/hero.png|Hero image|320]]'), [
    {
      rawMatch: '![[assets/hero.png|Hero image|320]]',
      linkPath: 'assets/hero.png',
      altText: 'Hero image',
      width: '320',
      isWikiLink: true,
    },
  ]);
});

test('malformed percent escapes in image paths do not abort document rendering', () => {
  const app = {
    metadataCache: { getFirstLinkpathDest: () => null },
    vault: { getAbstractFileByPath: () => null },
  };

  assert.equal(findTargetTFile(app as never, 'bad%path.png', 'note.md'), null);
});

test('upload cache is isolated when the configured destination changes', async () => {
  const file = new TFile();
  file.path = 'assets/image.png';
  file.name = 'image.png';
  file.basename = 'image';

  const bytes = new Uint8Array([1, 2, 3, 4]).buffer;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const settings = {
    ...structuredClone(DEFAULT_SETTINGS),
    uploaderType: 'github' as const,
    github: {
      ...DEFAULT_SETTINGS.github,
      repo: 'new-owner/new-repo',
    },
    uploadedCache: { [hash]: 'https://old-provider.example/image.png' },
  };

  let uploadCalls = 0;
  const result = await resolveAndUploadImages(
    '![[assets/image.png]]',
    'note.md',
    {
      metadataCache: { getFirstLinkpathDest: () => file },
      vault: { readBinary: async () => bytes },
    } as never,
    settings,
    {
      upload: async () => {
        uploadCalls += 1;
        return 'https://new-provider.example/image.png';
      },
    },
    async () => undefined
  );

  assert.equal(uploadCalls, 1);
  assert.equal(result.uploadedCount, 1);
  assert.match(result.processedMarkdown, /new-provider\.example/);
});

test('base64 preview data is not persisted in plugin settings', async () => {
  const file = new TFile();
  file.path = 'assets/image.png';
  file.name = 'image.png';
  file.basename = 'image';

  const settings = structuredClone(DEFAULT_SETTINGS);
  let saveCalls = 0;
  await resolveAndUploadImages(
    '![[assets/image.png]]',
    'note.md',
    {
      metadataCache: { getFirstLinkpathDest: () => file },
      vault: { readBinary: async () => new Uint8Array([1, 2, 3, 4]).buffer },
    } as never,
    settings,
    { upload: async () => 'data:image/png;base64,AQIDBA==' },
    async () => {
      saveCalls += 1;
    }
  );

  assert.deepEqual(settings.uploadedCache, {});
  assert.equal(saveCalls, 0);
});

test('local resource URLs bypass binary reads and Base64 conversion in previews', async () => {
  const file = new TFile();
  file.path = 'assets/image.png';
  file.name = 'image.png';
  file.basename = 'image';

  let readCalls = 0;
  let uploadCalls = 0;
  const result = await resolveAndUploadImages(
    '![[assets/image.png]]',
    'note.md',
    {
      metadataCache: { getFirstLinkpathDest: () => file },
      vault: {
        readBinary: async () => {
          readCalls += 1;
          return new Uint8Array([1, 2, 3, 4]).buffer;
        },
      },
    } as never,
    structuredClone(DEFAULT_SETTINGS),
    {
      upload: async () => {
        uploadCalls += 1;
        return 'data:image/png;base64,AQIDBA==';
      },
    },
    async () => undefined,
    { localResourceUrl: (target) => `app://local/${target.path}` }
  );

  assert.equal(readCalls, 0);
  assert.equal(uploadCalls, 0);
  assert.match(result.processedMarkdown, /app:\/\/local\/assets\/image\.png/);
});

test('Obsidian syntax transforms do not rewrite fenced or inline code', () => {
  const result = transformObsidianSyntax(`\`\`\`md
%% keep %%
==keep== [[Target|Alias]]
\`\`\`

\`==inline== [[Inline]]\`

==change== [[Target|Alias]] %% remove %%`);

  assert.match(result.content, /%% keep %%/);
  assert.match(result.content, /==keep== \[\[Target\|Alias\]\]/);
  assert.match(result.content, /\`==inline== \[\[Inline\]\]\`/);
  assert.match(result.content, /<mark[^>]*>change<\/mark> Alias/);
  assert.doesNotMatch(result.content, /%% remove %%/);
});

test('image-like examples inside code are not uploaded', () => {
  const markdown = `\`\`\`md
![[fenced.png]]
\`\`\`
\`![[inline.png]]\`
![[real.png]]`;

  assert.deepEqual(extractImages(markdown).map((image) => image.linkPath), ['real.png']);
});

test('commented-out images are not uploaded', () => {
  const markdown = `<!-- ![[hidden.png]] -->
![[real.png]]`;

  assert.deepEqual(extractImages(markdown).map((image) => image.linkPath), ['real.png']);
});
