import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type { CrispWechatPlugin } from './main';
import type { ThemeName, UploaderType } from './types';
import { createImageUploader } from './uploader';

export class CrispWechatSettingTab extends PluginSettingTab {
  plugin: CrispWechatPlugin;

  constructor(app: App, plugin: CrispWechatPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Crisp WeChat Publisher 设置' });
    containerEl.createEl('p', {
      text: '将 Obsidian 笔记一键排版并发布到微信公众号。基于 doocs/md 渲染引擎，支持多图床自动上传与离线 CSS 内联。',
      cls: 'setting-item-description',
    });

    // ==================== 排版设置 ====================
    containerEl.createEl('h3', { text: '🎨 微信排版与主题设置' });

    new Setting(containerEl)
      .setName('默认排版主题')
      .setDesc('选择默认文章排版风格 (也可在单篇笔记 Frontmatter 中使用 theme: grace 覆盖)')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('default', '默认经典 (Default)')
          .addOption('grace', '优雅精致 (Grace)')
          .addOption('simple', '极简现代 (Simple)')
          .setValue(this.plugin.settings.theme)
          .onChange(async (val) => {
            this.plugin.settings.theme = val as ThemeName;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('主题主色调')
      .setDesc('用于标题底色、边框、超链接及高亮的主题强调色')
      .addColorPicker((picker) =>
        picker.setValue(this.plugin.settings.primaryColor).onChange(async (val) => {
          this.plugin.settings.primaryColor = val;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('正文字号')
      .setDesc('文章正文默认基准字号 (推荐 15px 或 16px)')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('14px', '14px (紧凑)')
          .addOption('15px', '15px (推荐标准)')
          .addOption('16px', '16px (舒适大字)')
          .addOption('17px', '17px (超大字)')
          .setValue(this.plugin.settings.fontSize)
          .onChange(async (val) => {
            this.plugin.settings.fontSize = val;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Mac 风格代码块')
      .setDesc('在代码块顶部添加 macOS 经典红黄绿三色圆点与语言标识')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.isMacCodeBlock).onChange(async (val) => {
          this.plugin.settings.isMacCodeBlock = val;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('外链自动转文末脚注')
      .setDesc('微信公众号不支持外部跳转链接，开启后将正文外部超链接自动转换为文末带标号的参考文献引用')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.citeStatus).onChange(async (val) => {
          this.plugin.settings.citeStatus = val;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('自定义 CSS')
      .setDesc('为导出的微信 HTML 添加额外的自定义 CSS 规则 (具有最高优先级)')
      .addTextArea((text) =>
        text
          .setPlaceholder('/* e.g. h1 { letter-spacing: 2px; } */')
          .setValue(this.plugin.settings.customCSS)
          .onChange(async (val) => {
            this.plugin.settings.customCSS = val;
            await this.plugin.saveSettings();
          })
      );

    // ==================== 图床设置 ====================
    containerEl.createEl('h3', { text: '☁️ 图片自动上传与图床配置' });

    new Setting(containerEl)
      .setName('图床服务驱动')
      .setDesc('选择在排版时将本地图片自动上传到的图床存储服务')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('none', '离线 Base64 嵌入 (无需外部存储)')
          .addOption('s3', 'AWS S3 / Cloudflare R2 / MinIO (S3 兼容)')
          .addOption('oss', '阿里云 OSS')
          .addOption('cos', '腾讯云 COS')
          .addOption('qiniu', '七牛云 Kodo')
          .addOption('github', 'GitHub 图床')
          .setValue(this.plugin.settings.uploaderType)
          .onChange(async (val) => {
            this.plugin.settings.uploaderType = val as UploaderType;
            await this.plugin.saveSettings();
            this.display(); // Refresh UI for selected uploader
          })
      );

    // S3 / R2 Config
    if (this.plugin.settings.uploaderType === 's3') {
      containerEl.createEl('h4', { text: 'S3 / Cloudflare R2 配置' });

      new Setting(containerEl).setName('Endpoint').setDesc('如 https://<account_id>.r2.cloudflarestorage.com 或 s3.amazonaws.com').addText((t) =>
        t.setValue(this.plugin.settings.s3.endpoint).onChange(async (v) => {
          this.plugin.settings.s3.endpoint = v.trim();
          await this.plugin.saveSettings();
        })
      );

      new Setting(containerEl).setName('Region').setDesc('默认 auto 或 us-east-1').addText((t) =>
        t.setValue(this.plugin.settings.s3.region).onChange(async (v) => {
          this.plugin.settings.s3.region = v.trim();
          await this.plugin.saveSettings();
        })
      );

      new Setting(containerEl).setName('Bucket Name').setDesc('存储桶名称').addText((t) =>
        t.setValue(this.plugin.settings.s3.bucket).onChange(async (v) => {
          this.plugin.settings.s3.bucket = v.trim();
          await this.plugin.saveSettings();
        })
      );

      new Setting(containerEl).setName('Access Key ID').addText((t) =>
        t.setValue(this.plugin.settings.s3.accessKeyId).onChange(async (v) => {
          this.plugin.settings.s3.accessKeyId = v.trim();
          await this.plugin.saveSettings();
        })
      );

      new Setting(containerEl).setName('Secret Access Key').addText((t) => {
        t.inputEl.type = 'password';
        t.setValue(this.plugin.settings.s3.secretAccessKey).onChange(async (v) => {
          this.plugin.settings.s3.secretAccessKey = v.trim();
          await this.plugin.saveSettings();
        });
      });

      new Setting(containerEl).setName('自定义公网访问域名 (可选)').setDesc('如 https://cdn.example.com').addText((t) =>
        t.setValue(this.plugin.settings.s3.customDomain || '').onChange(async (v) => {
          this.plugin.settings.s3.customDomain = v.trim();
          await this.plugin.saveSettings();
        })
      );

      this.addTestUploadButton(containerEl);
    }

    // 阿里云 OSS Config
    if (this.plugin.settings.uploaderType === 'oss') {
      containerEl.createEl('h4', { text: '阿里云 OSS 配置' });

      new Setting(containerEl).setName('Region').setDesc('如 oss-cn-hangzhou').addText((t) =>
        t.setValue(this.plugin.settings.oss.region).onChange(async (v) => {
          this.plugin.settings.oss.region = v.trim();
          await this.plugin.saveSettings();
        })
      );

      new Setting(containerEl).setName('Bucket Name').addText((t) =>
        t.setValue(this.plugin.settings.oss.bucket).onChange(async (v) => {
          this.plugin.settings.oss.bucket = v.trim();
          await this.plugin.saveSettings();
        })
      );

      new Setting(containerEl).setName('AccessKey ID').addText((t) =>
        t.setValue(this.plugin.settings.oss.accessKeyId).onChange(async (v) => {
          this.plugin.settings.oss.accessKeyId = v.trim();
          await this.plugin.saveSettings();
        })
      );

      new Setting(containerEl).setName('AccessKey Secret').addText((t) => {
        t.inputEl.type = 'password';
        t.setValue(this.plugin.settings.oss.accessKeySecret).onChange(async (v) => {
          this.plugin.settings.oss.accessKeySecret = v.trim();
          await this.plugin.saveSettings();
        });
      });

      new Setting(containerEl).setName('自定义加速域名 (可选)').addText((t) =>
        t.setValue(this.plugin.settings.oss.customDomain || '').onChange(async (v) => {
          this.plugin.settings.oss.customDomain = v.trim();
          await this.plugin.saveSettings();
        })
      );

      this.addTestUploadButton(containerEl);
    }

    // 腾讯云 COS Config
    if (this.plugin.settings.uploaderType === 'cos') {
      containerEl.createEl('h4', { text: '腾讯云 COS 配置' });

      new Setting(containerEl).setName('Region').setDesc('如 ap-guangzhou / ap-beijing').addText((t) =>
        t.setValue(this.plugin.settings.cos.region).onChange(async (v) => {
          this.plugin.settings.cos.region = v.trim();
          await this.plugin.saveSettings();
        })
      );

      new Setting(containerEl).setName('Bucket Name').setDesc('如 mybucket-1250000000').addText((t) =>
        t.setValue(this.plugin.settings.cos.bucket).onChange(async (v) => {
          this.plugin.settings.cos.bucket = v.trim();
          await this.plugin.saveSettings();
        })
      );

      new Setting(containerEl).setName('SecretId').addText((t) =>
        t.setValue(this.plugin.settings.cos.secretId).onChange(async (v) => {
          this.plugin.settings.cos.secretId = v.trim();
          await this.plugin.saveSettings();
        })
      );

      new Setting(containerEl).setName('SecretKey').addText((t) => {
        t.inputEl.type = 'password';
        t.setValue(this.plugin.settings.cos.secretKey).onChange(async (v) => {
          this.plugin.settings.cos.secretKey = v.trim();
          await this.plugin.saveSettings();
        });
      });

      this.addTestUploadButton(containerEl);
    }

    // 七牛云 Config
    if (this.plugin.settings.uploaderType === 'qiniu') {
      containerEl.createEl('h4', { text: '七牛云 Kodo 配置' });

      new Setting(containerEl).setName('AccessKey').addText((t) =>
        t.setValue(this.plugin.settings.qiniu.accessKey).onChange(async (v) => {
          this.plugin.settings.qiniu.accessKey = v.trim();
          await this.plugin.saveSettings();
        })
      );

      new Setting(containerEl).setName('SecretKey').addText((t) => {
        t.inputEl.type = 'password';
        t.setValue(this.plugin.settings.qiniu.secretKey).onChange(async (v) => {
          this.plugin.settings.qiniu.secretKey = v.trim();
          await this.plugin.saveSettings();
        });
      });

      new Setting(containerEl).setName('Bucket Name').addText((t) =>
        t.setValue(this.plugin.settings.qiniu.bucket).onChange(async (v) => {
          this.plugin.settings.qiniu.bucket = v.trim();
          await this.plugin.saveSettings();
        })
      );

      new Setting(containerEl).setName('绑定加速域名').setDesc('如 https://img.example.com').addText((t) =>
        t.setValue(this.plugin.settings.qiniu.domain).onChange(async (v) => {
          this.plugin.settings.qiniu.domain = v.trim();
          await this.plugin.saveSettings();
        })
      );

      this.addTestUploadButton(containerEl);
    }

    // GitHub Config
    if (this.plugin.settings.uploaderType === 'github') {
      containerEl.createEl('h4', { text: 'GitHub 图床配置' });

      new Setting(containerEl).setName('GitHub Token').setDesc('具有 repo 写入权限的 Personal Access Token').addText((t) => {
        t.inputEl.type = 'password';
        t.setValue(this.plugin.settings.github.token).onChange(async (v) => {
          this.plugin.settings.github.token = v.trim();
          await this.plugin.saveSettings();
        });
      });

      new Setting(containerEl).setName('Repository').setDesc('用户名/仓库名 (如 owner/img-repo)').addText((t) =>
        t.setValue(this.plugin.settings.github.repo).onChange(async (v) => {
          this.plugin.settings.github.repo = v.trim();
          await this.plugin.saveSettings();
        })
      );

      new Setting(containerEl).setName('Branch').setDesc('分支 (默认 main)').addText((t) =>
        t.setValue(this.plugin.settings.github.branch).onChange(async (v) => {
          this.plugin.settings.github.branch = v.trim();
          await this.plugin.saveSettings();
        })
      );

      new Setting(containerEl).setName('CDN 加速前缀').setDesc('例如 https://fastly.jsdelivr.net/gh/').addText((t) =>
        t.setValue(this.plugin.settings.github.customCdn || '').onChange(async (v) => {
          this.plugin.settings.github.customCdn = v.trim();
          await this.plugin.saveSettings();
        })
      );

      this.addTestUploadButton(containerEl);
    }

    // Cache management
    containerEl.createEl('h3', { text: '⚡ 缓存与优化' });
    const cacheCount = Object.keys(this.plugin.settings.uploadedCache).length;
    new Setting(containerEl)
      .setName('本地图片上传缓存')
      .setDesc(`当前已记录 ${cacheCount} 张图片的 SHA-256 缓存，再次排版相同图片将秒级复用 CDN URL`)
      .addButton((btn) =>
        btn.setButtonText('清空上传缓存').onClick(async () => {
          this.plugin.settings.uploadedCache = {};
          await this.plugin.saveSettings();
          new Notice('✅ 上传缓存已清空');
          this.display();
        })
      );
  }

  private addTestUploadButton(containerEl: HTMLElement) {
    new Setting(containerEl)
      .setName('测试图床连接')
      .setDesc('上传一张 1x1 测试图片验证配置是否正确')
      .addButton((btn) =>
        btn.setButtonText('🚀 发送测试上传').onClick(async () => {
          btn.setDisabled(true);
          btn.setButtonText('上传中…');

          try {
            const uploader = createImageUploader(this.plugin.settings);
            // 1x1 transparent PNG sample
            const testPngBytes = new Uint8Array([
              0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
              0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
              0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
              0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
              0x42, 0x60, 0x82,
            ]);

            const url = await uploader.upload(`test-upload-${Date.now()}.png`, testPngBytes.buffer);
            new Notice(`✅ 图床测试成功！\n文件访问 URL: ${url}`, 8000);
          } catch (err) {
            console.error('[Crisp WeChat] Test upload failed:', err);
            new Notice(`❌ 测试上传失败: ${err instanceof Error ? err.message : String(err)}`, 8000);
          } finally {
            btn.setDisabled(false);
            btn.setButtonText('🚀 发送测试上传');
          }
        })
      );
  }
}
