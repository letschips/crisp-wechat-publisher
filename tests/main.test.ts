import test from 'node:test';
import assert from 'node:assert/strict';
import { CrispWechatPlugin } from '../src/main';
import { TFile } from 'obsidian';

test('loading partial saved settings keeps nested defaults', async () => {
  const plugin = Object.create(CrispWechatPlugin.prototype) as CrispWechatPlugin & {
    loadData: () => Promise<unknown>;
  };
  plugin.loadData = async () => ({ s3: { bucket: 'docs-images' } });

  await plugin.loadSettings();

  assert.equal(plugin.settings.s3.bucket, 'docs-images');
  assert.equal(plugin.settings.s3.region, 'auto');
  assert.equal(plugin.settings.s3.pathPrefix, 'uploads');
});

test('HTML export uses a vault-relative non-conflicting path', async () => {
  const activeFile = new TFile();
  activeFile.path = 'note.md';
  activeFile.name = 'note.md';
  activeFile.basename = 'note';
  activeFile.extension = 'md';
  activeFile.parent = { path: '/' };

  let writtenPath = '';
  const plugin = Object.create(CrispWechatPlugin.prototype) as CrispWechatPlugin;
  plugin.settings = structuredClone((await import('../src/types')).DEFAULT_SETTINGS);
  plugin.app = {
    workspace: { getActiveFile: () => activeFile },
    metadataCache: { getFirstLinkpathDest: () => null },
    vault: {
      read: async () => '# Export me',
      getAbstractFileByPath: () => null,
      adapter: {
        exists: async (path: string) => path === 'note-wechat.html',
        write: async (path: string) => {
          writtenPath = path;
        },
      },
    },
  } as never;

  await plugin.exportHtmlFile();

  assert.equal(writtenPath, 'note-wechat-2.html');
});

test('HTML export applies per-note color, size, and citation overrides', async () => {
  const activeFile = new TFile();
  activeFile.path = 'articles/note.md';
  activeFile.name = 'note.md';
  activeFile.basename = 'note';
  activeFile.extension = 'md';
  activeFile.parent = { path: 'articles' };

  let writtenHtml = '';
  const plugin = Object.create(CrispWechatPlugin.prototype) as CrispWechatPlugin;
  plugin.settings = structuredClone((await import('../src/types')).DEFAULT_SETTINGS);
  plugin.app = {
    workspace: { getActiveFile: () => activeFile },
    metadataCache: { getFirstLinkpathDest: () => null },
    vault: {
      read: async () => `---
primaryColor: "#123456"
fontSize: 18px
citeStatus: false
---
[OpenAI](https://openai.com)`,
      getAbstractFileByPath: () => null,
      adapter: {
        exists: async () => false,
        write: async (_path: string, html: string) => {
          writtenHtml = html;
        },
      },
    },
  } as never;

  await plugin.exportHtmlFile();

  assert.match(writtenHtml, /#123456/);
  assert.match(writtenHtml, /font-size: 18px/);
  assert.match(writtenHtml, /href="https:\/\/openai\.com"/);
  assert.doesNotMatch(writtenHtml, /引用链接与参考资料/);
});
