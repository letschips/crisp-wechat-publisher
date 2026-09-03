import { requestUrl } from 'obsidian';
import type { S3Config } from '../types';
import type { ImageUploader } from './index';

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key instanceof Uint8Array ? (key.slice().buffer as ArrayBuffer) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

async function sha256Hex(data: string | ArrayBuffer): Promise<string> {
  const buffer = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export class S3Uploader implements ImageUploader {
  constructor(private config: S3Config) {}

  async upload(fileName: string, buffer: ArrayBuffer): Promise<string> {
    const { endpoint, region, bucket, accessKeyId, secretAccessKey, customDomain, pathPrefix } = this.config;

    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
      throw new Error('S3/R2 配置不完整：缺少 endpoint, bucket, accessKeyId 或 secretAccessKey');
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

    // Parse URL
    let urlString = endpoint.startsWith('http') ? endpoint : `https://${endpoint}`;
    if (!urlString.endsWith('/')) urlString += '/';
    urlString += `${bucket}/${objectKey}`;

    const url = new URL(urlString);
    const host = url.host;
    const path = url.pathname;

    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);
    const service = 's3';
    const effectiveRegion = region || 'auto';

    const payloadHash = await sha256Hex(buffer);

    const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

    const canonicalRequest = `PUT\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    const hashedCanonicalRequest = await sha256Hex(canonicalRequest);

    const credentialScope = `${dateStamp}/${effectiveRegion}/${service}/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${hashedCanonicalRequest}`;

    // Calculate Signature
    const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${secretAccessKey}`), dateStamp);
    const kRegion = await hmacSha256(kDate, effectiveRegion);
    const kService = await hmacSha256(kRegion, service);
    const kSigning = await hmacSha256(kService, 'aws4_request');
    const signatureBuffer = await hmacSha256(kSigning, stringToSign);
    const signature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const response = await requestUrl({
      url: url.toString(),
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'x-amz-date': amzDate,
        'x-amz-content-sha256': payloadHash,
        Authorization: authorizationHeader,
      },
      body: buffer,
    });

    if (response.status !== 200 && response.status !== 204) {
      throw new Error(`S3/R2 上传失败 (${response.status}): ${response.text}`);
    }

    if (customDomain) {
      const base = customDomain.endsWith('/') ? customDomain : `${customDomain}/`;
      return `${base}${objectKey}`;
    }

    return url.toString();
  }
}
