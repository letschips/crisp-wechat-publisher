import { requestUrl } from 'obsidian';
import type { CosConfig } from '../types';
import type { ImageUploader } from './index';

async function sha1Hex(data: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSha1Hex(key: string, data: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export class CosUploader implements ImageUploader {
  constructor(private config: CosConfig) {}

  async upload(fileName: string, buffer: ArrayBuffer): Promise<string> {
    const { region, bucket, secretId, secretKey, customDomain, pathPrefix } = this.config;

    if (!region || !bucket || !secretId || !secretKey) {
      throw new Error('腾讯云 COS 配置不完整：缺少 region, bucket, secretId 或 secretKey');
    }

    const now = new Date();
    const datePath = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    const timestamp = Date.now();
    const cleanFileName = `${timestamp}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const prefix = pathPrefix ? `${pathPrefix.replace(/\/+$/, '')}/` : '';
    const objectKey = `${prefix}${datePath}/${cleanFileName}`;

    const ext = fileName.split('.').pop()?.toLowerCase() || 'png';
    let contentType = 'image/png';
    if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
    else if (ext === 'gif') contentType = 'image/gif';
    else if (ext === 'webp') contentType = 'image/webp';
    else if (ext === 'svg') contentType = 'image/svg+xml';

    const host = `${bucket}.cos.${region}.myqcloud.com`;
    const pathname = `/${objectKey}`;

    const startTimestamp = Math.floor(Date.now() / 1000) - 60;
    const endTimestamp = startTimestamp + 3600;
    const keyTime = `${startTimestamp};${endTimestamp}`;

    const signKey = await hmacSha1Hex(secretKey, keyTime);
    const httpString = `put\n${pathname}\n\nhost=${host.toLowerCase()}\n`;
    const stringToSign = `sha1\n${keyTime}\n${await sha1Hex(httpString)}\n`;
    const signature = await hmacSha1Hex(signKey, stringToSign);

    const authHeader = `q-sign-algorithm=sha1&q-ak=${secretId}&q-sign-time=${keyTime}&q-key-time=${keyTime}&q-header-list=host&q-url-param-list=&q-signature=${signature}`;

    const url = `https://${host}${pathname}`;
    const response = await requestUrl({
      url,
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        Host: host,
        Authorization: authHeader,
      },
      body: buffer,
    });

    if (response.status !== 200) {
      throw new Error(`腾讯云 COS 上传失败 (${response.status}): ${response.text}`);
    }

    if (customDomain) {
      const base = customDomain.endsWith('/') ? customDomain : `${customDomain}/`;
      return `${base}${objectKey}`;
    }

    return url;
  }
}
