import type { PluginSettings } from '../types';
import { Base64Uploader } from './base64';
import { CosUploader } from './cos';
import { GitHubUploader } from './github';
import { OssUploader } from './oss';
import { QiniuUploader } from './qiniu';
import { S3Uploader } from './s3';

export interface ImageUploader {
  upload(fileName: string, buffer: ArrayBuffer): Promise<string>;
}

export function createImageUploader(settings: PluginSettings): ImageUploader {
  switch (settings.uploaderType) {
    case 's3':
      return new S3Uploader(settings.s3);
    case 'oss':
      return new OssUploader(settings.oss);
    case 'cos':
      return new CosUploader(settings.cos);
    case 'qiniu':
      return new QiniuUploader(settings.qiniu);
    case 'github':
      return new GitHubUploader(settings.github);
    case 'base64':
    case 'none':
    default:
      return new Base64Uploader();
  }
}
