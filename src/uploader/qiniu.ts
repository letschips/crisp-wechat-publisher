import { requestUrl } from 'obsidian';
import type { QiniuConfig } from '../types';
import type { ImageUploader } from './index';

function base64UrlEncode(str: string | Uint8Array): string {
  let binary = '';
  if (typeof str === 'string') {
    const bytes = new TextEncoder().encode(str);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  } else {
    for (let i = 0; i < str.length; i++) binary += String.fromCharCode(str[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_');
}

async function hmacSha1Bytes(key: string, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  return new Uint8Array(signature);
}

export class QiniuUploader implements ImageUploader {
  constructor(private config: QiniuConfig) {}

  async upload(fileName: string, buffer: ArrayBuffer): Promise<string> {
    const { accessKey, secretKey, bucket, domain, uploadHost, pathPrefix } = this.config;

    if (!accessKey || !secretKey || !bucket || !domain) {
      throw new Error('七牛云配置不完整：缺少 accessKey, secretKey, bucket 或 domain');
    }

    const now = new Date();
    const datePath = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    const timestamp = Date.now();
    const cleanFileName = `${timestamp}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const prefix = pathPrefix ? `${pathPrefix.replace(/\/+$/, '')}/` : '';
    const key = `${prefix}${datePath}/${cleanFileName}`;

    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const putPolicy = JSON.stringify({
      scope: `${bucket}:${key}`,
      deadline,
    });

    const encodedPolicy = base64UrlEncode(putPolicy);
    const sign = await hmacSha1Bytes(secretKey, encodedPolicy);
    const encodedSign = base64UrlEncode(sign);
    const uploadToken = `${accessKey}:${encodedSign}:${encodedPolicy}`;

    // Construct form multipart body manually
    const boundary = `----WebKitFormBoundary${Date.now().toString(16)}`;
    const ext = fileName.split('.').pop()?.toLowerCase() || 'png';
    let contentType = 'image/png';
    if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
    else if (ext === 'gif') contentType = 'image/gif';
    else if (ext === 'webp') contentType = 'image/webp';
    else if (ext === 'svg') contentType = 'image/svg+xml';

    const header = `--${boundary}\r\nContent-Disposition: form-data; name="token"\r\n\r\n${uploadToken}\r\n--${boundary}\r\nContent-Disposition: form-data; name="key"\r\n\r\n${key}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${contentType}\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;

    const enc = new TextEncoder();
    const headerBytes = enc.encode(header);
    const footerBytes = enc.encode(footer);
    const fileBytes = new Uint8Array(buffer);

    const bodyBytes = new Uint8Array(headerBytes.length + fileBytes.length + footerBytes.length);
    bodyBytes.set(headerBytes, 0);
    bodyBytes.set(fileBytes, headerBytes.length);
    bodyBytes.set(footerBytes, headerBytes.length + fileBytes.length);

    const host = uploadHost || 'https://upload.qiniup.com';
    const response = await requestUrl({
      url: host,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: bodyBytes.buffer,
    });

    if (response.status !== 200) {
      throw new Error(`七牛云上传失败 (${response.status}): ${response.text}`);
    }

    const domainBase = domain.endsWith('/') ? domain : `${domain}/`;
    const finalDomain = domainBase.startsWith('http') ? domainBase : `https://${domainBase}`;
    return `${finalDomain}${key}`;
  }
}
