import { ItemView, WorkspaceLeaf, Notice, TFile, MarkdownView } from 'obsidian';
import type { PluginSettings, ThemeName } from '../types';
import { inlineWechatCSS, RenderOverrides } from '../core/juice-inliner';
import { parseAndRenderMarkdown } from '../core/renderer';
import { transformObsidianSyntax } from '../preprocessor/obsidian-syntax';
import { resolveAndUploadImages } from '../preprocessor/image-resolver';
import { createImageUploader } from '../uploader';
import { CRISP_WECHAT_ICON_ID } from './icons';

export const WECHAT_PREVIEW_VIEW_TYPE = 'crisp-wechat-preview-view';

export class WechatPreviewView extends ItemView {
  private settings: PluginSettings;
  private contentContainer!: HTMLElement;
  private syncScrollBtn!: HTMLButtonElement;

  // Sync scroll state
  private isSyncScroll: boolean = true;
  private scrollCleanup: (() => void) | null = null;
  private isSyncing: boolean = false;
  private sourceView: MarkdownView | null = null;
  private debounceTimer: number | null = null;
  private pendingMarkdown: string | null = null;
  private pendingFile: TFile | null = null;
  private isLiveUpdateRunning = false;
  private liveUpdateQueued = false;
  private updateVersion = 0;

  // Live overrides for sidebar
  private currentTheme?: ThemeName;
  private currentColor?: string;
  private publish: (file: TFile, overrides?: RenderOverrides) => Promise<boolean>;

  constructor(
    leaf: WorkspaceLeaf,
    settings: PluginSettings,
    publish: (file: TFile, overrides?: RenderOverrides) => Promise<boolean>
  ) {
    super(leaf);
    this.settings = settings;
    this.publish = publish;
  }

  getViewType(): string {
    return WECHAT_PREVIEW_VIEW_TYPE;
  }

  getDisplayText(): string {
    return '微信公众号排版预览';
  }

  getIcon(): string {
    return CRISP_WECHAT_ICON_ID;
  }

  async onOpen() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('cwp-leaf-container');

    // ==================== Toolbar ====================
    const toolbar = container.createDiv({ cls: 'cwp-leaf-toolbar' });

    const leftControls = toolbar.createDiv({ cls: 'cwp-leaf-controls-left' });
    leftControls.style.display = 'flex';
    leftControls.style.gap = '6px';
    leftControls.style.alignItems = 'center';

    // Copy Button
    const copyBtn = leftControls.createEl('button', { cls: 'cwp-btn-primary' });
    copyBtn.setText('📋 复制排版');
    copyBtn.title = '复制内联样式的微信公众号富文本';
    copyBtn.addEventListener('click', async () => {
      await this.copyCurrentContent(copyBtn);
    });

    // Sync Scroll Toggle Button
    this.syncScrollBtn = leftControls.createEl('button', {
      cls: `cwp-btn-secondary ${this.isSyncScroll ? 'is-active-btn' : ''}`,
    });
    this.updateSyncButtonState();
    this.syncScrollBtn.addEventListener('click', () => {
      this.isSyncScroll = !this.isSyncScroll;
      this.updateSyncButtonState();
      if (this.isSyncScroll) {
        this.bindEditorScroll();
        this.syncScrollFromEditor();
        new Notice('🔗 已开启左右编辑同步滚动');
      } else {
        new Notice('⛓️ 已关闭同步滚动');
      }
    });

    const rightControls = toolbar.createDiv({ cls: 'cwp-leaf-controls-right' });
    rightControls.style.display = 'flex';
    rightControls.style.gap = '6px';
    rightControls.style.alignItems = 'center';

    // Theme Switcher Dropdown
    const themeSelect = rightControls.createEl('select', { cls: 'cwp-leaf-select' });
    themeSelect.createEl('option', { value: 'default', text: '经典' });
    themeSelect.createEl('option', { value: 'grace', text: '优雅' });
    themeSelect.createEl('option', { value: 'simple', text: '简洁' });
    themeSelect.value = this.currentTheme || this.settings.theme;
    themeSelect.addEventListener('change', async () => {
      this.currentTheme = themeSelect.value as ThemeName;
      await this.update();
    });

    // ==================== Content Area ====================
    this.contentContainer = container.createDiv({ cls: 'cwp-leaf-content' });

    // Initial render and bind scroll
    await this.update();
    this.bindEditorScroll();

    // Rebind when switching leaves
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', (leaf) => {
        if (leaf?.view instanceof MarkdownView) {
          this.sourceView = leaf.view;
          this.update();
          this.bindEditorScroll();
        }
      })
    );

    // Render from the editor buffer so the sidebar never waits for a vault read.
    this.registerEvent(
      this.app.workspace.on('editor-change', (editor, info) => {
        const activeFile = this.app.workspace.getActiveFile();
        if (!info.file || info.file.path !== activeFile?.path) return;

        this.pendingMarkdown = editor.getValue();
        this.pendingFile = info.file;
        if (info instanceof MarkdownView) this.sourceView = info;

        if (this.debounceTimer) window.clearTimeout(this.debounceTimer);
        this.debounceTimer = window.setTimeout(() => {
          this.debounceTimer = null;
          void this.flushLiveUpdate();
        }, 16);
      })
    );
  }

  private async flushLiveUpdate() {
    if (this.isLiveUpdateRunning) {
      this.liveUpdateQueued = true;
      return;
    }

    const markdown = this.pendingMarkdown;
    const file = this.pendingFile;
    if (markdown === null || !file) return;

    this.pendingMarkdown = null;
    this.pendingFile = null;
    this.isLiveUpdateRunning = true;

    try {
      await this.update(false, markdown, file);
    } finally {
      this.isLiveUpdateRunning = false;
      if (this.pendingMarkdown !== null || this.liveUpdateQueued) {
        this.liveUpdateQueued = false;
        if (this.debounceTimer) {
          window.clearTimeout(this.debounceTimer);
          this.debounceTimer = null;
        }
        void this.flushLiveUpdate();
      }
    }
  }

  private updateSyncButtonState() {
    if (this.syncScrollBtn) {
      if (this.isSyncScroll) {
        this.syncScrollBtn.setText('🔗 同步滚动');
        this.syncScrollBtn.style.color = 'var(--text-accent)';
        this.syncScrollBtn.style.borderColor = 'var(--interactive-accent)';
      } else {
        this.syncScrollBtn.setText('⛓️ 自由滚动');
        this.syncScrollBtn.style.color = 'var(--text-muted)';
        this.syncScrollBtn.style.borderColor = 'var(--background-modifier-border)';
      }
    }
  }

  /**
   * Bind scroll listener to active Markdown editor DOM
   */
  public bindEditorScroll() {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) this.sourceView = activeView;
    const mdView = activeView || this.sourceView;
    if (!mdView) return;

    if (this.scrollCleanup) {
      this.scrollCleanup();
      this.scrollCleanup = null;
    }

    // Find CodeMirror 6 scroller or preview element
    const scroller =
      mdView.contentEl.querySelector('.cm-scroller') ||
      mdView.contentEl.querySelector('.markdown-preview-view');

    if (!scroller) return;

    const onEditorScroll = () => {
      if (!this.isSyncScroll || this.isSyncing || !scroller || !this.contentContainer) return;

      const maxEditorScroll = scroller.scrollHeight - scroller.clientHeight;
      if (maxEditorScroll <= 0) return;

      const scrollRatio = scroller.scrollTop / maxEditorScroll;
      const maxPreviewScroll = this.contentContainer.scrollHeight - this.contentContainer.clientHeight;

      if (maxPreviewScroll > 0) {
        this.isSyncing = true;
        this.contentContainer.scrollTop = scrollRatio * maxPreviewScroll;
        window.requestAnimationFrame(() => {
          this.isSyncing = false;
        });
      }
    };

    scroller.addEventListener('scroll', onEditorScroll, { passive: true });
    this.scrollCleanup = () => {
      scroller.removeEventListener('scroll', onEditorScroll);
    };
  }

  private syncScrollFromEditor() {
    const mdView = this.app.workspace.getActiveViewOfType(MarkdownView) || this.sourceView;
    if (!mdView || !this.contentContainer) return;

    const scroller =
      mdView.contentEl.querySelector('.cm-scroller') ||
      mdView.contentEl.querySelector('.markdown-preview-view');

    if (!scroller) return;

    const maxEditorScroll = scroller.scrollHeight - scroller.clientHeight;
    if (maxEditorScroll <= 0) return;

    const scrollRatio = scroller.scrollTop / maxEditorScroll;
    const maxPreviewScroll = this.contentContainer.scrollHeight - this.contentContainer.clientHeight;
    if (maxPreviewScroll > 0) {
      this.contentContainer.scrollTop = scrollRatio * maxPreviewScroll;
    }
  }

  async update(
    rebindScroll: boolean = true,
    rawMarkdownOverride?: string,
    sourceFile?: TFile
  ) {
    if (!this.contentContainer) return;
    const requestVersion = ++this.updateVersion;

    const workspaceFile = this.app.workspace.getActiveFile();
    if (sourceFile && sourceFile.path !== workspaceFile?.path) return;
    const activeFile = sourceFile || workspaceFile;
    if (!activeFile || activeFile.extension !== 'md') {
      this.contentContainer.innerHTML =
        '<div style="color: #999; text-align: center; margin-top: 40px; font-size: 13px;">请在左侧打开一篇 Markdown 笔记查看微信排版实时预览</div>';
      return;
    }

    const savedScrollTop = this.contentContainer.scrollTop;

    const rawMarkdown = rawMarkdownOverride ?? (await this.app.vault.read(activeFile));
    const { content, themeOverride, primaryColorOverride, fontSizeOverride, citeStatusOverride } =
      transformObsidianSyntax(rawMarkdown);

    const activeSettings: PluginSettings = {
      ...this.settings,
      theme: this.currentTheme || themeOverride || this.settings.theme,
      primaryColor: this.currentColor || primaryColorOverride || this.settings.primaryColor,
      fontSize: fontSizeOverride || this.settings.fontSize,
      citeStatus: citeStatusOverride ?? this.settings.citeStatus,
    };

    const previewSettings: PluginSettings = {
      ...activeSettings,
      uploaderType: 'none',
      uploadedCache: {},
    };
    const { processedMarkdown } = await resolveAndUploadImages(
      content,
      activeFile.path,
      this.app,
      previewSettings,
      createImageUploader(previewSettings),
      async () => undefined,
      { localResourceUrl: (file) => this.app.vault.getResourcePath(file) }
    );
    if (requestVersion !== this.updateVersion) return;

    const { html } = parseAndRenderMarkdown(processedMarkdown, activeSettings);
    const overrides: RenderOverrides = {
      theme: activeSettings.theme,
      primaryColor: activeSettings.primaryColor,
    };

    const inlinedHtml = inlineWechatCSS(html, activeSettings, overrides);
    this.contentContainer.innerHTML = inlinedHtml;

    if (this.isSyncScroll) {
      this.syncScrollFromEditor();
    } else {
      this.contentContainer.scrollTop = savedScrollTop;
    }

    if (rebindScroll) {
      this.bindEditorScroll();
    }
  }

  private async copyCurrentContent(btn: HTMLButtonElement) {
    const origText = btn.innerText;
    btn.disabled = true;
    btn.setText('正在准备…');
    try {
      const activeFile = this.app.workspace.getActiveFile();
      if (!activeFile) return;
      const copied = await this.publish(activeFile, {
        theme: this.currentTheme,
        primaryColor: this.currentColor,
      });
      if (copied) {
        btn.setText('✅ 已复制！');
        setTimeout(() => btn.setText(origText), 2000);
      } else {
        btn.setText(origText);
      }
    } catch (err) {
      console.error('[Crisp WeChat] Copy error:', err);
      new Notice(`❌ 复制失败: ${err instanceof Error ? err.message : String(err)}`);
      btn.setText(origText);
    } finally {
      btn.disabled = false;
    }
  }

  async onClose() {
    this.updateVersion += 1;
    this.pendingMarkdown = null;
    this.pendingFile = null;
    this.liveUpdateQueued = false;
    if (this.debounceTimer) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.scrollCleanup) {
      this.scrollCleanup();
      this.scrollCleanup = null;
    }
  }
}
