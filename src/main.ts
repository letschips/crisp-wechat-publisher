/**
 * 致谢 / Credits
 *
 * 本插件的部分代码改编自 doocs/md (https://github.com/doocs/md),
 * 一款开源的微信 Markdown 编辑器, 基于 WTFPL 许可证发布。
 * 感谢原作者的工作。
 *
 * Portions of this plugin are adapted from doocs/md (https://github.com/doocs/md),
 * an open-source WeChat Markdown editor released under the WTFPL license.
 */

import { App, Plugin, Notice, TFile, Menu, addIcon } from 'obsidian';
import { PluginSettings, DEFAULT_SETTINGS } from './types';
import { preserveUnreadableData, verifyDataWrite } from './data-safety';
import { CrispWechatSettingTab } from './settings';
import { transformObsidianSyntax } from './preprocessor/obsidian-syntax';
import { resolveAndUploadImages } from './preprocessor/image-resolver';
import { createImageUploader } from './uploader';
import { parseAndRenderMarkdown } from './core/renderer';
import { inlineWechatCSS, RenderOverrides } from './core/juice-inliner';
import { WechatPreviewModal } from './ui/preview-modal';
import { WechatPreviewView, WECHAT_PREVIEW_VIEW_TYPE } from './ui/preview-view';
import { CRISP_WECHAT_ICON_ID, CRISP_WECHAT_SVG } from './ui/icons';

export class CrispWechatPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();

    // 0. Register Custom Icon
    try {
      addIcon(CRISP_WECHAT_ICON_ID, CRISP_WECHAT_SVG);
      addIcon('crisp-wechat-publisher', CRISP_WECHAT_SVG);
    } catch (e) {
      console.warn('[Crisp WeChat] Failed to register custom icon:', e);
    }

    // 1. Register Setting Tab
    this.addSettingTab(new CrispWechatSettingTab(this.app, this));

    // 2. Register Preview View
    this.registerView(
      WECHAT_PREVIEW_VIEW_TYPE,
      (leaf) =>
        new WechatPreviewView(leaf, this.settings, (file, overrides) =>
          this.publishToWechatClipboard(file, overrides)
        )
    );

    // 3. Register Ribbon Icon
    this.addRibbonIcon(CRISP_WECHAT_ICON_ID, 'Crisp WeChat: 微信公众号排版', (evt: MouseEvent) => {
      const menu = new Menu();

      menu.addItem((item) =>
        item
          .setTitle('📋 一键上传并复制微信排版')
          .setIcon('copy')
          .onClick(async () => {
            await this.publishToWechatClipboard();
          })
      );

      menu.addItem((item) =>
        item
          .setTitle('📱 手机视口弹窗预览')
          .setIcon('layout')
          .onClick(async () => {
            await this.openPreviewModal();
          })
      );

      menu.addItem((item) =>
        item
          .setTitle('📑 打开侧边栏实时预览')
          .setIcon('sidebar-right')
          .onClick(async () => {
            await this.activateSidebarView();
          })
      );

      menu.showAtMouseEvent(evt);
    });

    // 4. Register Commands
    this.addCommand({
      id: 'copy-wechat-rich-text',
      name: '一键复制到微信公众号 (自动上传图片+排版)',
      callback: async () => {
        await this.publishToWechatClipboard();
      },
    });

    this.addCommand({
      id: 'open-wechat-preview-modal',
      name: '在手机视口中预览微信文章',
      callback: async () => {
        await this.openPreviewModal();
      },
    });

    this.addCommand({
      id: 'open-wechat-sidebar-view',
      name: '在侧边栏打开实时预览',
      callback: async () => {
        await this.activateSidebarView();
      },
    });

    this.addCommand({
      id: 'export-wechat-html-file',
      name: '导出为微信内联 HTML 文件',
      callback: async () => {
        await this.exportHtmlFile();
      },
    });

    // Auto update sidebar preview if active leaf changes
    this.registerEvent(
      this.app.workspace.on('file-open', () => {
        const leaves = this.app.workspace.getLeavesOfType(WECHAT_PREVIEW_VIEW_TYPE);
        for (const leaf of leaves) {
          if (leaf.view instanceof WechatPreviewView) {
            leaf.view.update();
          }
        }
      })
    );
  }

  private dataWriteBlocked = false;
  private saveErrorShown = false;

  private get dataPath(): string {
    return `${this.manifest.dir}/data.json`;
  }

  async loadSettings() {
    const saved = (await this.loadData()) as Partial<PluginSettings> | null | undefined;
    if (saved === undefined) {
      // The file exists but could not be read: keep it (and the image upload cache in it) out of harm's way.
      const result = await preserveUnreadableData(this.app.vault.adapter, this.dataPath);
      if (result.state === 'preserved') {
        new Notice(`Crisp WeChat Publisher 的 data.json 无法读取，已备份为 ${result.backupPath.split('/').pop()}，本次使用默认设置。图床配置需要重新填写，或从备份恢复。`, 12000);
      } else if (result.state === 'failed') {
        this.dataWriteBlocked = true;
        console.error('Crisp WeChat Publisher could not back up unreadable data.json', result.error);
        new Notice('Crisp WeChat Publisher 的 data.json 无法读取，也无法备份。为保护原文件，本次运行不会保存设置。', 0);
      }
    }
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...saved,
      s3: { ...DEFAULT_SETTINGS.s3, ...(saved?.s3 || {}) },
      oss: { ...DEFAULT_SETTINGS.oss, ...(saved?.oss || {}) },
      cos: { ...DEFAULT_SETTINGS.cos, ...(saved?.cos || {}) },
      qiniu: { ...DEFAULT_SETTINGS.qiniu, ...(saved?.qiniu || {}) },
      github: { ...DEFAULT_SETTINGS.github, ...(saved?.github || {}) },
      imageCompress: { ...DEFAULT_SETTINGS.imageCompress, ...(saved?.imageCompress || {}) },
      uploadedCache: { ...(saved?.uploadedCache || {}) },
    };
  }

  // Never throws: it also persists the upload cache mid-publish, which a failed save must not abort.
  async saveSettings() {
    if (this.dataWriteBlocked) return;
    const snapshot = JSON.parse(JSON.stringify(this.settings));
    try {
      await this.saveData(snapshot);
      await verifyDataWrite(this.app.vault.adapter, this.dataPath, snapshot);
      this.saveErrorShown = false;
    } catch (error) {
      console.error('Crisp WeChat Publisher could not save data.json', error);
      if (!this.saveErrorShown) {
        this.saveErrorShown = true;
        new Notice('Crisp WeChat Publisher：设置或图床缓存没有写入磁盘，下次保存时会再试。');
      }
    }
  }

  /**
   * Core action: Resolve active note, upload images, compile markdown, inline CSS, copy to clipboard
   */
  async publishToWechatClipboard(
    sourceFile?: TFile | null,
    overrides?: RenderOverrides
  ): Promise<boolean> {
    const activeFile = sourceFile || this.app.workspace.getActiveFile();
    if (!activeFile || activeFile.extension !== 'md') {
      new Notice('⚠️ 请先打开一篇要排版的 Markdown 笔记。');
      return false;
    }

    const notice = new Notice('⏳ 正在解析笔记并准备排版…', 0);

    try {
      const rawMarkdown = await this.app.vault.read(activeFile);

      // 1. Transform syntax (strip Frontmatter, callouts to alerts, wikilinks)
      const transformed = transformObsidianSyntax(rawMarkdown);
      const activeSettings = this.getDocumentSettings(transformed, overrides);

      // 2. Resolve & Upload Images
      notice.setMessage('⏳ 正在解析并上传本地图片…');
      const uploader = createImageUploader(this.settings);
      const { processedMarkdown, uploadedCount, cachedCount, compressedCount, bytesSaved, totalBytes } =
        await resolveAndUploadImages(
          transformed.content,
          activeFile.path,
          this.app,
          activeSettings,
          uploader,
          () => this.saveSettings()
        );

      // 3. Render Markdown & Footnotes
      notice.setMessage('⏳ 正在进行微信样式渲染与 CSS 内联…');
      const { html } = parseAndRenderMarkdown(processedMarkdown, activeSettings);

      // 4. Inline CSS with juice
      const inlinedHtml = inlineWechatCSS(html, activeSettings, overrides);

      // 5. Write to System Clipboard
      const textBlob = new Blob([processedMarkdown], { type: 'text/plain' });
      const htmlBlob = new Blob([inlinedHtml], { type: 'text/html' });

      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': textBlob,
        }),
      ]);

      notice.hide();

      let statMsg = '🎉 微信公众号排版已复制到剪贴板！';
      if (compressedCount > 0 && bytesSaved > 0) {
        const savedMB = (bytesSaved / (1024 * 1024)).toFixed(1);
        const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);
        statMsg += `\n📦 已智能无损压缩 ${compressedCount} 张图片 (立省 ${savedMB}MB，最终体积 ${totalMB}MB，安全符合微信 10M 规范)`;
      }
      if (uploadedCount > 0 || cachedCount > 0) {
        statMsg += `\n☁️ 新上传 ${uploadedCount} 张图片，复用 ${cachedCount} 张缓存`;
      }
      statMsg += '\n👉 直接在公众号编辑器按 Cmd+V / Ctrl+V 粘贴即可。';
      new Notice(statMsg, 6000);
      return true;
    } catch (err) {
      notice.hide();
      console.error('[Crisp WeChat] Error during publish:', err);
      new Notice(`❌ 排版发布失败: ${err instanceof Error ? err.message : String(err)}`, 6000);
      return false;
    }
  }

  async openPreviewModal() {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile || activeFile.extension !== 'md') {
      new Notice('⚠️ 请先打开一篇 Markdown 笔记');
      return;
    }

    const notice = new Notice('⏳ 正在准备预览…', 0);
    try {
      const rawMarkdown = await this.app.vault.read(activeFile);
      const transformed = transformObsidianSyntax(rawMarkdown);
      const activeSettings = this.getDocumentSettings(transformed);

      // Previewing must never upload externally. Obsidian serves local images via lightweight resource URLs.
      const previewSettings: PluginSettings = {
        ...activeSettings,
        uploaderType: 'none',
        uploadedCache: {},
      };
      const { processedMarkdown } = await resolveAndUploadImages(
        transformed.content,
        activeFile.path,
        this.app,
        previewSettings,
        createImageUploader(previewSettings),
        async () => undefined,
        { localResourceUrl: (file) => this.app.vault.getResourcePath(file) }
      );

      notice.hide();
      new WechatPreviewModal(
        this.app,
        activeFile,
        processedMarkdown,
        activeSettings,
        activeSettings.theme,
        activeSettings.primaryColor,
        activeSettings.fontFamily,
        activeSettings.fontSize,
        (renderOverrides) => this.publishToWechatClipboard(activeFile, renderOverrides)
      ).open();
    } catch (err) {
      notice.hide();
      console.error('[Crisp WeChat] Failed to open preview:', err);
      new Notice(`❌ 预览加载失败: ${err instanceof Error ? err.message : String(err)}`, 6000);
    }
  }

  async activateSidebarView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(WECHAT_PREVIEW_VIEW_TYPE)[0];

    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({
          type: WECHAT_PREVIEW_VIEW_TYPE,
          active: true,
        });
        leaf = rightLeaf;
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  async exportHtmlFile() {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile || activeFile.extension !== 'md') {
      new Notice('⚠️ 请先打开一篇 Markdown 笔记');
      return;
    }

    const notice = new Notice('⏳ 正在导出微信 HTML…', 0);
    try {
      const rawMarkdown = await this.app.vault.read(activeFile);
      const transformed = transformObsidianSyntax(rawMarkdown);
      const activeSettings = this.getDocumentSettings(transformed);

      const uploader = createImageUploader(activeSettings);
      const { processedMarkdown } = await resolveAndUploadImages(
        transformed.content,
        activeFile.path,
        this.app,
        activeSettings,
        uploader,
        () => this.saveSettings()
      );

      const { html } = parseAndRenderMarkdown(processedMarkdown, activeSettings);
      const inlinedHtml = inlineWechatCSS(html, activeSettings);
      const targetPath = await this.getAvailableExportPath(activeFile);
      await this.app.vault.adapter.write(targetPath, inlinedHtml);
      notice.hide();
      new Notice(`✅ 已成功导出 HTML 到: ${targetPath}`);
    } catch (err) {
      notice.hide();
      console.error('[Crisp WeChat] Failed to export HTML:', err);
      new Notice(`❌ 导出失败: ${err instanceof Error ? err.message : String(err)}`, 6000);
    }
  }

  private getDocumentSettings(
    transformed: ReturnType<typeof transformObsidianSyntax>,
    overrides?: RenderOverrides
  ): PluginSettings {
    return {
      ...this.settings,
      theme: overrides?.theme || transformed.themeOverride || this.settings.theme,
      primaryColor: overrides?.primaryColor || transformed.primaryColorOverride || this.settings.primaryColor,
      fontFamily: overrides?.fontFamily || this.settings.fontFamily,
      fontSize: overrides?.fontSize || transformed.fontSizeOverride || this.settings.fontSize,
      citeStatus: overrides?.citeStatus ?? transformed.citeStatusOverride ?? this.settings.citeStatus,
      isMacCodeBlock: overrides?.isMacCodeBlock ?? this.settings.isMacCodeBlock,
      isUseIndent: overrides?.isUseIndent ?? this.settings.isUseIndent,
      isUseJustify: overrides?.isUseJustify ?? this.settings.isUseJustify,
    };
  }

  private async getAvailableExportPath(activeFile: TFile): Promise<string> {
    const folder = activeFile.parent?.path && activeFile.parent.path !== '/' ? `${activeFile.parent.path}/` : '';
    const basePath = `${folder}${activeFile.basename}-wechat`;
    let candidate = `${basePath}.html`;
    let suffix = 2;

    while (await this.app.vault.adapter.exists(candidate)) {
      candidate = `${basePath}-${suffix}.html`;
      suffix += 1;
    }

    return candidate;
  }
}

export default CrispWechatPlugin;
