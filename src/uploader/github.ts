import { requestUrl } from 'obsidian';
import type { GitHubConfig } from '../types';
import type { ImageUploader } from './index';
import { bufferToBase64 } from './base64';

export class GitHubUploader implements ImageUploader {
  constructor(private config: GitHubConfig) {}

  async upload(fileName: string, buffer: ArrayBuffer): Promise<string> {
    const { token, repo, branch, pathPrefix, customCdn } = this.config;

    if (!token || !repo) {
      throw new Error('GitHub 图床配置不完整：缺少 Token 或 Repository');
    }

    const now = new Date();
    const datePath = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    const timestamp = Date.now();
    const cleanFileName = `${timestamp}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const prefix = pathPrefix ? `${pathPrefix.replace(/\/+$/, '')}/` : '';
    const fullPath = `${prefix}${datePath}/${cleanFileName}`;

    // Convert buffer to base64 safely
    const base64Content = bufferToBase64(buffer);

    const url = `https://api.github.com/repos/${repo}/contents/${fullPath}`;
    const response = await requestUrl({
      url,
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Obsidian-Crisp-WeChat-Publisher',
      },
      body: JSON.stringify({
        message: `Upload ${fileName} via Crisp WeChat Publisher`,
        content: base64Content,
        branch: branch || 'main',
      }),
    });

    if (response.status !== 201 && response.status !== 200) {
      throw new Error(`GitHub 上传失败 (${response.status}): ${response.text}`);
    }

    // Build CDN URL
    if (customCdn) {
      const cdnBase = customCdn.endsWith('/') ? customCdn : `${customCdn}/`;
      return `${cdnBase}${repo}@${branch || 'main'}/${fullPath}`;
    }

    return response.json.content.download_url;
  }
}
