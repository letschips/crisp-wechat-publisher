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

test('plugin registers custom svg icon and uses it for preview view and ribbon', async () => {
  const { CRISP_WECHAT_ICON_ID, CRISP_WECHAT_SVG } = await import('../src/ui/icons');
  const { WechatPreviewView } = await import('../src/ui/preview-view');

  assert.equal(CRISP_WECHAT_ICON_ID, 'crisp-wechat');
  assert.match(CRISP_WECHAT_SVG, /viewBox="0 0 24 24"/);
  assert.match(CRISP_WECHAT_SVG, /<path/);

  const view = Object.create(WechatPreviewView.prototype) as WechatPreviewView;
  assert.equal(view.getIcon(), CRISP_WECHAT_ICON_ID);
});


test('typing in the editor renders the sidebar preview once after a pause, not on every keystroke', async () => {
  const { WechatPreviewView, PREVIEW_LIVE_UPDATE_DELAY_MS } = await import('../src/ui/preview-view');
  // One preview render costs ~40ms for a typical article and ~350ms for a long one.
  assert.ok(PREVIEW_LIVE_UPDATE_DELAY_MS >= 250, `waits ${PREVIEW_LIVE_UPDATE_DELAY_MS}ms`);
  const timers = new Map<number, () => void>();
  const delays: number[] = [];
  let id = 0;
  const previousWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    setTimeout: (fn: () => void, ms: number) => { delays.push(ms); timers.set(++id, fn); return id; },
    clearTimeout: (key: number) => { timers.delete(key); },
  };
  try {
    const view = Object.create(WechatPreviewView.prototype) as InstanceType<typeof WechatPreviewView> & Record<string, unknown>;
    Object.assign(view, { debounceTimer: null, pendingMarkdown: null, pendingFile: null, pendingEditor: null, isLiveUpdateRunning: false, liveUpdateQueued: false });
    const updates: string[] = [];
    view.update = async (_rebind?: boolean, markdown?: string) => { updates.push(markdown ?? ''); };
    let text = '';
    let reads = 0;
    const editor = { getValue: () => { reads++; return text; } };
    const file = new TFile();
    file.path = 'a.md';
    const queue = (view as unknown as { queueLiveUpdate(e: unknown, f: TFile): void }).queueLiveUpdate.bind(view);
    for (const ch of 'hello') { text += ch; queue(editor, file); }
    assert.equal(timers.size, 1);
    assert.equal(reads, 0, 'the note text is read once, when the preview renders');
    assert.equal(delays.at(-1), PREVIEW_LIVE_UPDATE_DELAY_MS);
    [...timers.values()][0]();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(updates, ['hello']);
    assert.equal(reads, 1);
  } finally {
    (globalThis as { window?: unknown }).window = previousWindow;
  }
});

test('edits typed while a preview render is running are rendered right after it', async () => {
  const { WechatPreviewView } = await import('../src/ui/preview-view');
  const timers = new Map<number, () => void>();
  let id = 0;
  const previousWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    setTimeout: (fn: () => void) => { timers.set(++id, fn); return id; },
    clearTimeout: (key: number) => { timers.delete(key); },
  };
  try {
    const view = Object.create(WechatPreviewView.prototype) as InstanceType<typeof WechatPreviewView> & Record<string, unknown>;
    Object.assign(view, { debounceTimer: null, pendingMarkdown: null, pendingFile: null, pendingEditor: null, isLiveUpdateRunning: false, liveUpdateQueued: false });
    const updates: string[] = [];
    let release: () => void = () => {};
    view.update = (_rebind?: boolean, markdown?: string) => {
      updates.push(markdown ?? '');
      return updates.length === 1 ? new Promise<void>((resolve) => { release = resolve; }) : Promise.resolve();
    };
    let text = 'a';
    const editor = { getValue: () => text };
    const file = new TFile();
    file.path = 'a.md';
    const queue = (view as unknown as { queueLiveUpdate(e: unknown, f: TFile): void }).queueLiveUpdate.bind(view);
    queue(editor, file);
    [...timers.values()].pop()!();
    assert.deepEqual(updates, ['a']);
    text = 'ab';queue(editor, file);
    [...timers.values()].pop()!();
    text = 'abc';queue(editor, file);
    release();
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(updates.at(-1), 'abc');
  } finally {
    (globalThis as { window?: unknown }).window = previousWindow;
  }
});
