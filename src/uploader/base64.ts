import type { ImageUploader } from './index';

export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 16384;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as any);
  }
  return btoa(binary);
}

export class Base64Uploader implements ImageUploader {
  async upload(fileName: string, buffer: ArrayBuffer): Promise<string> {
    const ext = fileName.split('.').pop()?.toLowerCase() || 'png';
    let mime = 'image/png';
    if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
    else if (ext === 'gif') mime = 'image/gif';
    else if (ext === 'webp') mime = 'image/webp';
    else if (ext === 'svg') mime = 'image/svg+xml';

    const base64 = bufferToBase64(buffer);
    return `data:${mime};base64,${base64}`;
  }
}
