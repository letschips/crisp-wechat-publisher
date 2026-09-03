import { requestUrl } from 'obsidian';
import type { OssConfig } from '../types';
import type { ImageUploader } from './index';

async function hmacSha1(key: string, data: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  const bytes = new Uint8Array(signature);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export class OssUploader implements ImageUploader {
  constructor(private config: OssConfig) {}

  async upload(fileName: string, buffer: ArrayBuffer): Promise<string> {
    const { region, bucket, accessKeyId, accessKeySecret, customDomain, pathPrefix } = this.config;

    if (!region || !bucket || !accessKeyId || !accessKeySecret) {
      throw new Error('阿里云 OSS 配置不完整：缺少 region, bucket, accessKeyId 或 accessKeySecret');
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

    const dateString = now.toUTCString();
    const stringToSign = `PUT\n\n${contentType}\n${dateString}\n/${bucket}/${objectKey}`;
    const signature = await hmacSha1(accessKeySecret, stringToSign);
    const authorization = `OSS ${accessKeyId}:${signature}`;

    const host = `${bucket}.${region}.aliyuncs.com`;
    const url = `https://${host}/${objectKey}`;

    const response = await requestUrl({
      url,
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        Date: dateString,
        Authorization: authorization,
      },
      body: buffer,
    });

    if (response.status !== 200) {
      throw new Error(`阿里云 OSS 上传失败 (${response.status}): ${response.text}`);
    }

    if (customDomain) {
      const base = customDomain.endsWith('/') ? customDomain : `${customDomain}/`;
      return `${base}${objectKey}`;
    }

    return url;
  }
}
