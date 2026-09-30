import { App, Modal, Notice, TFile } from 'obsidian';
import type { PluginSettings, ThemeName } from '../types';
import { PRESET_COLORS, FONT_FAMILY_PRESETS, FONT_SIZE_PRESETS } from '../types';
import { inlineWechatCSS, RenderOverrides } from '../core/juice-inliner';
import { parseAndRenderMarkdown } from '../core/renderer';

export class WechatPreviewModal extends Modal {
  private activeFile: TFile | null;
  private rawMarkdown: string;
  private settings: PluginSettings;

  // Live Inspector State
  private currentTheme: ThemeName;
  private currentColor: string;
  private currentFont: string;
  private currentFontSize: string;
  private isMacCodeBlock: boolean;
  private isUseIndent: boolean;
  private isUseJustify: boolean;
  private isInspectorOpen: boolean = true;
  private isShowSafeArea: boolean = false;

  private previewEl!: HTMLElement;
  private statEl!: HTMLElement;
  private inspectorEl!: HTMLElement;
  private copyHandler?: (overrides: RenderOverrides) => Promise<boolean>;

  constructor(
    app: App,
    activeFile: TFile | null,
    rawMarkdown: string,
    settings: PluginSettings,
    initialTheme?: ThemeName,
    initialColor?: string,
    initialFont?: string,
    initialSize?: string,
    copyHandler?: (overrides: RenderOverrides) => Promise<boolean>
  ) {
    super(app);
    this.activeFile = activeFile;
    this.rawMarkdown = rawMarkdown;
    this.settings = settings;

    this.currentTheme = initialTheme || settings.theme;
    this.currentColor = initialColor || settings.primaryColor;
    this.currentFont = initialFont || settings.fontFamily;
    this.currentFontSize = initialSize || settings.fontSize || '15px';
    this.isMacCodeBlock = settings.isMacCodeBlock;
    this.isUseIndent = settings.isUseIndent;
    this.isUseJustify = settings.isUseJustify;
    this.copyHandler = copyHandler;
  }

  onOpen() {
    const { contentEl, modalEl } = this;
    modalEl.addClass('cwp-preview-modal');

    // Force strict flex layout on modal container
    modalEl.style.setProperty('display', 'flex', 'important');
    modalEl.style.setProperty('flex-direction', 'column', 'important');
    modalEl.style.setProperty('height', '90vh', 'important');
    modalEl.style.setProperty('max-height', '90vh', 'important');
    modalEl.style.setProperty('width', '94vw', 'important');
    modalEl.style.setProperty('max-width', '1180px', 'important');
    modalEl.style.setProperty('padding', '0', 'important');
    modalEl.style.setProperty('margin', '0', 'important');
    modalEl.style.setProperty('overflow', 'hidden', 'important');
    modalEl.style.setProperty('background', 'var(--background-secondary)', 'important');
    modalEl.style.setProperty('border', '1px solid var(--background-modifier-border)', 'important');

    contentEl.empty();
    contentEl.style.setProperty('display', 'flex', 'important');
    contentEl.style.setProperty('flex-direction', 'column', 'important');
    contentEl.style.setProperty('height', '100%', 'important');
    contentEl.style.setProperty('max-height', '100%', 'important');
    contentEl.style.setProperty('flex', '1 1 auto', 'important');
    contentEl.style.setProperty('padding', '0', 'important');
    contentEl.style.setProperty('margin', '0', 'important');
    contentEl.style.setProperty('margin-top', '0', 'important');
    contentEl.style.setProperty('overflow', 'hidden', 'important');
    contentEl.style.setProperty('min-height', '0', 'important');
    contentEl.style.setProperty('background', 'transparent', 'important');
    contentEl.style.setProperty('border', 'none', 'important');

    // ==================== Header ====================
    const header = contentEl.createDiv({ cls: 'cwp-modal-header' });
    header.style.setProperty('margin', '0', 'important');
    header.style.setProperty('border-top', 'none', 'important');

    const titleEl = header.createDiv({ cls: 'cwp-modal-title' });
    titleEl.setText('📱 微信公众号排版预览');

    const controls = header.createDiv({ cls: 'cwp-modal-controls' });

    // Word Count Stats
    this.statEl = controls.createDiv({ cls: 'cwp-stat-text' });

    // Writeback to Frontmatter Button
    if (this.activeFile) {
      const saveFmBtn = controls.createEl('button', { cls: 'cwp-btn-secondary' });
      saveFmBtn.setText('💾 记住到笔记');
      saveFmBtn.title = '将当前选择的主题与配色写回当前笔记 Frontmatter';
      saveFmBtn.addEventListener('click', async () => {
        await this.writebackToFrontmatter(saveFmBtn);
      });
    }

    // Toggle Inspector Button
    const toggleInspectorBtn = controls.createEl('button', { cls: 'cwp-btn-secondary' });
    toggleInspectorBtn.setText('🎨 样式面板');
    toggleInspectorBtn.setAttribute('aria-expanded', String(this.isInspectorOpen));
    toggleInspectorBtn.addEventListener('click', () => {
      this.isInspectorOpen = !this.isInspectorOpen;
      toggleInspectorBtn.setAttribute('aria-expanded', String(this.isInspectorOpen));
      if (this.inspectorEl) {
        this.inspectorEl.style.display = this.isInspectorOpen ? 'block' : 'none';
      }
    });

    // Toggle 1:1 Cover Safe Area Button
    const safeAreaBtn = controls.createEl('button', {
      cls: `cwp-btn-secondary ${this.isShowSafeArea ? 'is-active-btn' : ''}`,
    });
    safeAreaBtn.setText('🛡️ 1:1 封面安全区');
    safeAreaBtn.title = '在头图上显示朋友圈与会话卡片 1:1 居中裁剪参考线';
    safeAreaBtn.addEventListener('click', () => {
      this.isShowSafeArea = !this.isShowSafeArea;
      safeAreaBtn.toggleClass('is-active-btn', this.isShowSafeArea);
      if (this.isShowSafeArea) {
        safeAreaBtn.style.color = 'var(--text-accent)';
        safeAreaBtn.style.borderColor = 'var(--interactive-accent)';
      } else {
        safeAreaBtn.style.color = '';
        safeAreaBtn.style.borderColor = '';
      }
      this.applySafeAreaOverlay();
    });


    // Copy Button (Primary Green)
    const copyBtn = controls.createEl('button', { cls: 'cwp-btn-primary' });
    copyBtn.setText('📋 复制微信排版');
    copyBtn.addEventListener('click', async () => {
      await this.copyToClipboard(copyBtn);
    });

    const closeBtn = controls.createEl('button', {
      cls: 'cwp-btn-secondary cwp-modal-close',
      text: '关闭',
    });
    closeBtn.setAttribute('aria-label', '关闭微信公众号排版预览');
    closeBtn.addEventListener('click', () => this.close());

    // ==================== Main Split Body ====================
    const splitBody = contentEl.createDiv({ cls: 'cwp-modal-split-body' });

    // 1. Center Preview Canvas Area
    const canvasArea = splitBody.createDiv({ cls: 'cwp-preview-body' });
    const phoneContainer = canvasArea.createDiv({ cls: 'cwp-phone-container' });

    const notch = phoneContainer.createDiv({ cls: 'cwp-phone-notch' });
    notch.createSpan({ text: '9:41' });
    notch.createSpan({ text: '微信公众号' });
    notch.createSpan({ text: '100% 🔋' });

    this.previewEl = phoneContainer.createDiv({ cls: 'cwp-phone-content' });

    // 2. Right Inspector Sidebar Panel
    this.inspectorEl = splitBody.createDiv({ cls: 'cwp-modal-inspector' });
    this.renderInspector(this.inspectorEl);

    // Initial render
    this.updatePreview();
  }

  private renderInspector(container: HTMLElement) {
    container.empty();

    // Section 1: 主题 (Themes)
    const themeSection = container.createDiv({ cls: 'cwp-inspector-section' });
    themeSection.createDiv({ cls: 'cwp-inspector-label', text: '主题风格' });
    const themePills = themeSection.createDiv({ cls: 'cwp-segmented' });
    const themes: { id: ThemeName; label: string }[] = [
      { id: 'default', label: '经典' },
      { id: 'grace', label: '优雅' },
      { id: 'simple', label: '简洁' },
    ];
    for (const t of themes) {
      const pill = themePills.createEl('button', {
        cls: `cwp-segmented-item ${this.currentTheme === t.id ? 'is-active' : ''}`,
        text: t.label,
      });
      pill.setAttribute('aria-pressed', String(this.currentTheme === t.id));
      pill.addEventListener('click', () => {
        this.currentTheme = t.id;
        this.renderInspector(container);
        this.updatePreview();
      });
    }

    // Section 2: 字体 (Font Family)
    const fontSection = container.createDiv({ cls: 'cwp-inspector-section' });
    fontSection.createDiv({ cls: 'cwp-inspector-label', text: '字体系列' });
    const fontPills = fontSection.createDiv({ cls: 'cwp-segmented' });
    for (const f of FONT_FAMILY_PRESETS) {
      const pill = fontPills.createEl('button', {
        cls: `cwp-segmented-item ${this.currentFont === f.value ? 'is-active' : ''}`,
        text: f.name,
      });
      pill.setAttribute('aria-pressed', String(this.currentFont === f.value));
      pill.addEventListener('click', () => {
        this.currentFont = f.value;
        this.renderInspector(container);
        this.updatePreview();
      });
    }

    // Section 3: 字号 (Font Size)
    const sizeSection = container.createDiv({ cls: 'cwp-inspector-section' });
    sizeSection.createDiv({ cls: 'cwp-inspector-label', text: '基准字号' });
    const sizePills = sizeSection.createDiv({ cls: 'cwp-segmented' });
    for (const s of FONT_SIZE_PRESETS) {
      const pill = sizePills.createEl('button', {
        cls: `cwp-segmented-item ${this.currentFontSize === s ? 'is-active' : ''}`,
        text: s,
      });
      pill.setAttribute('aria-pressed', String(this.currentFontSize === s));
      pill.addEventListener('click', () => {
        this.currentFontSize = s;
        this.renderInspector(container);
        this.updatePreview();
      });
    }

    // Section 4: 预设主题色 (Preset Colors)
    const colorSection = container.createDiv({ cls: 'cwp-inspector-section' });
    colorSection.createDiv({ cls: 'cwp-inspector-label', text: '品牌主题色' });
    const colorGrid = colorSection.createDiv({ cls: 'cwp-color-grid' });

    for (const cp of PRESET_COLORS) {
      const isSelected = this.currentColor.toLowerCase() === cp.color.toLowerCase();
      const chip = colorGrid.createEl('button', {
        cls: `cwp-color-chip ${isSelected ? 'is-active' : ''}`,
      });
      chip.type = 'button';
      chip.setAttribute('aria-label', `使用${cp.name} ${cp.color}`);
      chip.setAttribute('aria-pressed', String(isSelected));

      const dot = chip.createSpan({ cls: 'cwp-color-dot' });
      dot.style.backgroundColor = cp.color;

      chip.createSpan({ cls: 'cwp-color-name', text: cp.name });

      chip.addEventListener('click', () => {
        this.currentColor = cp.color;
        this.renderInspector(container);
        this.updatePreview();
      });
    }

    // Custom color picker row
    const customColorRow = colorSection.createDiv({ cls: 'cwp-custom-color-row' });
    customColorRow.createSpan({ text: '自定义色值：' });
    const colorPicker = customColorRow.createEl('input', { type: 'color' });
    colorPicker.value = this.currentColor;
    colorPicker.addEventListener('input', () => {
      this.currentColor = colorPicker.value;
      this.updatePreview();
    });

    const hexInput = customColorRow.createEl('input', { type: 'text', cls: 'cwp-hex-input' });
    hexInput.value = this.currentColor;
    hexInput.addEventListener('change', () => {
      if (/^#[0-9A-Fa-f]{6}$/.test(hexInput.value.trim())) {
        this.currentColor = hexInput.value.trim();
        this.renderInspector(container);
        this.updatePreview();
      }
    });

    // Section 5: 排版开关 (Switches)
    const switchSection = container.createDiv({ cls: 'cwp-inspector-section' });
    switchSection.createDiv({ cls: 'cwp-inspector-label', text: '排版选项' });

    // Mac code block toggle
    this.createToggleRow(switchSection, 'Mac 风格代码块', this.isMacCodeBlock, (val) => {
      this.isMacCodeBlock = val;
      this.updatePreview();
    });

    // First line indent toggle
    this.createToggleRow(switchSection, '段落首行缩进 (2格)', this.isUseIndent, (val) => {
      this.isUseIndent = val;
      this.updatePreview();
    });

    // Justify text toggle
    this.createToggleRow(switchSection, '两端对齐 (Justify)', this.isUseJustify, (val) => {
      this.isUseJustify = val;
      this.updatePreview();
    });
  }

  private createToggleRow(container: HTMLElement, label: string, currentVal: boolean, onChange: (v: boolean) => void) {
    const row = container.createDiv({ cls: 'cwp-toggle-row' });
    row.createSpan({ text: label });
    const checkbox = row.createEl('input', { type: 'checkbox' });
    checkbox.checked = currentVal;
    checkbox.addEventListener('change', () => {
      onChange(checkbox.checked);
    });
  }

  private generateHtml(): string {
    const activeSettings: PluginSettings = {
      ...this.settings,
      theme: this.currentTheme,
      primaryColor: this.currentColor,
      fontFamily: this.currentFont,
      fontSize: this.currentFontSize,
      isMacCodeBlock: this.isMacCodeBlock,
      isUseIndent: this.isUseIndent,
      isUseJustify: this.isUseJustify,
    };

    const { html } = parseAndRenderMarkdown(this.rawMarkdown, activeSettings);
    const overrides: RenderOverrides = {
      theme: this.currentTheme,
      primaryColor: this.currentColor,
      fontFamily: this.currentFont,
      fontSize: this.currentFontSize,
      isUseIndent: this.isUseIndent,
      isUseJustify: this.isUseJustify,
    };

    return inlineWechatCSS(html, activeSettings, overrides);
  }

  private updatePreview() {
    const inlinedHtml = this.generateHtml();
    this.previewEl.innerHTML = inlinedHtml;

    // Calculate word count
    const plainText = this.previewEl.innerText || '';
    const charCount = plainText.replace(/\s+/g, '').length;
    const readMinutes = Math.max(1, Math.round(charCount / 400));
    this.statEl.setText(`约 ${charCount} 字 · ${readMinutes} 分钟读完`);

    this.applySafeAreaOverlay();
  }

  private applySafeAreaOverlay() {
    const existing = this.previewEl.querySelectorAll('.cwp-safe-area-overlay');
    existing.forEach((el) => el.remove());

    if (!this.isShowSafeArea) return;

    // Find the first image in previewEl
    const firstImg = this.previewEl.querySelector('img') as HTMLImageElement | null;
    if (!firstImg) return;

    const wrapper = firstImg.closest('figure') || firstImg.parentElement;
    if (!wrapper) return;

    wrapper.style.position = 'relative';

    const overlay = document.createElement('div');
    overlay.className = 'cwp-safe-area-overlay';
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      aspect-ratio: 1 / 1;
      height: 100%;
      max-width: 100%;
      border: 2px dashed #07c160;
      background: rgba(7, 193, 96, 0.12);
      pointer-events: none;
      box-sizing: border-box;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding-bottom: 6px;
      z-index: 10;
    `;

    const badge = document.createElement('span');
    badge.style.cssText = `
      font-size: 11px;
      background: rgba(0, 0, 0, 0.75);
      color: #ffffff;
      padding: 2px 6px;
      border-radius: 4px;
      letter-spacing: 0.5px;
      font-weight: 500;
      white-space: nowrap;
    `;
    badge.innerText = '🛡️ 1:1 分享卡片裁剪区';
    overlay.appendChild(badge);

    wrapper.appendChild(overlay);
  }


  private async writebackToFrontmatter(btn: HTMLButtonElement) {
    if (!this.activeFile) return;

    try {
      await this.app.fileManager.processFrontMatter(this.activeFile, (fm) => {
        fm.theme = this.currentTheme;
        fm.primaryColor = this.currentColor;
        fm.fontSize = this.currentFontSize;
      });

      const orig = btn.innerText;
      btn.setText('✅ 已记住');
      setTimeout(() => btn.setText(orig), 2000);
      new Notice(`✅ 已成功将排版参数写入笔记 Frontmatter: theme: ${this.currentTheme}, primaryColor: ${this.currentColor}`);
    } catch (err) {
      console.error('[Crisp WeChat] Failed to writeback frontmatter:', err);
      new Notice(`❌ 写入 Frontmatter 失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async copyToClipboard(btn: HTMLButtonElement) {
    const origText = btn.innerText;
    btn.disabled = true;
    btn.setText('正在准备…');
    try {
      const overrides: RenderOverrides = {
        theme: this.currentTheme,
        primaryColor: this.currentColor,
        fontFamily: this.currentFont,
        fontSize: this.currentFontSize,
        isMacCodeBlock: this.isMacCodeBlock,
        isUseIndent: this.isUseIndent,
        isUseJustify: this.isUseJustify,
      };

      if (this.copyHandler) {
        const copied = await this.copyHandler(overrides);
        if (copied) {
          btn.setText('✅ 已复制！');
          setTimeout(() => btn.setText(origText), 2000);
        } else {
          btn.setText(origText);
        }
        return;
      }

      const inlinedHtml = this.generateHtml();
      const textBlob = new Blob([this.previewEl.innerText || this.rawMarkdown], { type: 'text/plain' });
      const htmlBlob = new Blob([inlinedHtml], { type: 'text/html' });

      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': textBlob,
        }),
      ]);

      btn.setText('✅ 已复制！');
      setTimeout(() => btn.setText(origText), 2000);

      new Notice('🎉 微信排版已复制！直接前往微信公众号后台按 Cmd+V / Ctrl+V 粘贴。');
    } catch (err) {
      console.error('[Crisp WeChat] Copy failed:', err);
      new Notice(`❌ 复制失败: ${err instanceof Error ? err.message : String(err)}`);
      btn.setText(origText);
    } finally {
      btn.disabled = false;
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
