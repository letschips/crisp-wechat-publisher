# Crisp WeChat Publisher

> 微信公众号排版与图床发布插件。基于 doocs/md 渲染引擎，自动识别本地图片/Wikilink 并上传图床，一键生成并复制微信公众号兼容富文本。

Part of the **Crisp Series** for Obsidian by [letschips](https://github.com/letschips).

---

## ✨ Features (功能特性)

- 📝 **Markdown 转微信富文本**：高保真排版渲染，一键生成并复制微信公众号兼容的带内联样式富文本，直接粘贴至公众号后台无痛排版。
- 🖼️ **本地图片与 Wikilink 自动上传**：自动解析笔记中的本地图片与 `![[...]]` 附件，在发布时自动上传至配置图床并替换为在线 URL。
- ☁️ **多图床支持**：内置主流图床服务适配，包括 S3 兼容对象存储、阿里云 OSS、腾讯云 COS、七牛云 Kodo 以及 GitHub 图床。
- 📮 **公众号草稿箱一键直推**：支持配置微信公众平台 AppID 与 AppSecret，一键将排版内容保存至草稿箱。
- 🎨 **主题与样式定制**：内置多种经典公众号排版主题与代码高亮配色，支持自定义全局 CSS 样式。
- 🛡️ **100% 免费开源·无需激活码**：完全免费开源，基于 MIT 协议，无需商业激活码，安装即用。

---

## 📦 Installation (安装方法)

### 方法一：通过 BRAT 安装（推荐，支持一键更新）

1. 在 Obsidian 社区插件中安装并启用 **[Obsidian42 - BRAT](https://github.com/TfTHacker/obsidian42-brat)** 插件。
2. 打开 Obsidian 设置 → **BRAT** → **Add Beta plugin**。
3. 输入 `letschips/crisp-wechat-publisher`，点击 **Add Plugin**。
4. 在 **已安装插件（Community plugins）** 列表中启用 **Crisp WeChat Publisher**。

### 方法二：手动安装

1. 前往 [Releases](https://github.com/letschips/crisp-wechat-publisher/releases) 页面下载最新版本的发布文件：`main.js`、`manifest.json`、`styles.css`。
2. 在您的 Obsidian 库插件目录中创建文件夹：
   `<Vault>/.obsidian/plugins/crisp-wechat-publisher/`
3. 将下载的 3 个文件复制到该文件夹中。
4. 重启 Obsidian 或在设置中重新加载插件列表，并启用 **Crisp WeChat Publisher**。

---

## 🚀 Quick Start (快速开始)

1. 在 Obsidian 中打开任意 Markdown 笔记。
2. 点击左侧 Ribbon 图标，或通过命令面板（`Cmd + P`）运行 `Crisp WeChat Publisher: 复制为微信公众号富文本`。
3. 前往微信公众号后台图文编辑器，直接粘贴（`Cmd + V`）即可。

---

## ⚙️ Settings (配置说明)

- **排版主题**：选择预设的经典排版主题、字体家族、主色调与字号大小。
- **代码高亮**：支持 Mac 风格代码块、行号显示与多种高亮主题。
- **图床配置**：在设置页面选择图床类型（S3 / OSS / COS / 七牛云 / GitHub），填入对应的访问凭证。配置后在转换或推送到草稿箱时会自动将笔记中引用的本地附件上传替换。
- **草稿箱直推**：填入微信公众号的 AppID 与 AppSecret 即可启用一键推送草稿。

---

## 🔒 Privacy & Security (隐私与安全)

- **本地优先**：所有 Markdown 渲染和 HTML 生成均在本地端完成。
- **凭据安全**：插件本地设置 `data.json` 仅保留在您的个人 Vault 中，不随任何仓库发布，无任何云端数据收集与遥测。
- **免激活码**：无需任何账号注册或授权码，安装即可使用全部功能。

---

## 📄 致谢 / Credits

本插件的部分核心渲染机制改编自优秀的开源项目 [doocs/md](https://github.com/doocs/md)（基于 WTFPL 许可证发布）。非常感谢原作者与社区的贡献。

Portions of this plugin are adapted from [doocs/md](https://github.com/doocs/md), an open-source WeChat Markdown editor released under the WTFPL license.

---

## 📄 License

[MIT License](LICENSE) © 2026 [letschips](https://github.com/letschips)
