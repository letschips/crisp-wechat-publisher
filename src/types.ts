export type ThemeName = 'default' | 'grace' | 'simple';

export type UploaderType = 'none' | 's3' | 'oss' | 'cos' | 'qiniu' | 'github' | 'base64';

export interface ColorPreset {
  id: string;
  name: string;
  color: string;
}

export const PRESET_COLORS: ColorPreset[] = [
  { id: 'classic-blue', name: '经典蓝', color: '#0F4C81' },
  { id: 'emerald-green', name: '翡翠绿', color: '#07C160' },
  { id: 'vibrant-orange', name: '活力橘', color: '#FA5151' },
  { id: 'lemon-yellow', name: '柠檬黄', color: '#FAAD14' },
  { id: 'lavender', name: '薰衣草', color: '#722ED1' },
  { id: 'sky-blue', name: '天空蓝', color: '#1890FF' },
  { id: 'rose-gold', name: '玫瑰金', color: '#EB2F96' },
  { id: 'olive-green', name: '橄榄绿', color: '#52C41A' },
  { id: 'graphite-black', name: '石墨黑', color: '#262626' },
  { id: 'smoky-gray', name: '雾烟灰', color: '#8C8C8C' },
  { id: 'sakura-pink', name: '樱花粉', color: '#FF85C0' },
];

export const FONT_FAMILY_PRESETS: { id: string; name: string; value: string }[] = [
  {
    id: 'sans',
    name: '无衬线',
    value: '-apple-system-font, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif',
  },
  {
    id: 'serif',
    name: '衬线',
    value: 'Optima-Regular, Optima, PingFangSC-light, PingFangTC-light, "PingFang SC", Cambria, Cochin, Georgia, Times, "Times New Roman", serif',
  },
  {
    id: 'mono',
    name: '等宽',
    value: 'Menlo, Monaco, Consolas, "Courier New", "PingFang SC", "Microsoft YaHei", monospace',
  },
];

export const FONT_SIZE_PRESETS = ['14px', '15px', '16px', '17px', '18px'];

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  customDomain?: string;
  pathPrefix?: string;
}

export interface OssConfig {
  region: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  customDomain?: string;
  pathPrefix?: string;
}

export interface CosConfig {
  secretId: string;
  secretKey: string;
  bucket: string;
  region: string;
  customDomain?: string;
  pathPrefix?: string;
}

export interface QiniuConfig {
  accessKey: string;
  secretKey: string;
  bucket: string;
  domain: string;
  uploadHost?: string;
  pathPrefix?: string;
}

export interface GitHubConfig {
  token: string;
  repo: string;
  branch: string;
  pathPrefix?: string;
  customCdn?: string;
}

export interface PluginSettings {
  theme: ThemeName;
  primaryColor: string;
  fontFamily: string;
  fontSize: string;
  isMacCodeBlock: boolean;
  isShowLineNumber: boolean;
  citeStatus: boolean;
  countStatus: boolean;
  isUseIndent: boolean;
  isUseJustify: boolean;
  customCSS: string;

  // 图床配置
  uploaderType: UploaderType;
  s3: S3Config;
  oss: OssConfig;
  cos: CosConfig;
  qiniu: QiniuConfig;
  github: GitHubConfig;

  // 图片压缩配置 (防微信 10M 限制)
  imageCompress: ImageCompressConfig;

  // 上传缓存哈希表 (md5 -> cdnUrl)
  uploadedCache: Record<string, string>;
}

export interface ImageCompressConfig {
  enabled: boolean;
  maxWidth: number;
  quality: number;
  format: 'auto' | 'jpeg' | 'png';
  minSizeKB: number;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  theme: 'default',
  primaryColor: '#0F4C81',
  fontFamily: FONT_FAMILY_PRESETS[0].value,
  fontSize: '15px',
  isMacCodeBlock: true,
  isShowLineNumber: false,
  citeStatus: true,
  countStatus: false,
  isUseIndent: false,
  isUseJustify: true,
  customCSS: '',

  uploaderType: 'none',
  s3: {
    endpoint: '',
    region: 'auto',
    bucket: '',
    accessKeyId: '',
    secretAccessKey: '',
    customDomain: '',
    pathPrefix: 'uploads',
  },
  oss: {
    region: 'oss-cn-hangzhou',
    bucket: '',
    accessKeyId: '',
    accessKeySecret: '',
    customDomain: '',
    pathPrefix: 'uploads',
  },
  cos: {
    secretId: '',
    secretKey: '',
    bucket: '',
    region: 'ap-guangzhou',
    customDomain: '',
    pathPrefix: 'uploads',
  },
  qiniu: {
    accessKey: '',
    secretKey: '',
    bucket: '',
    domain: '',
    uploadHost: 'https://upload.qiniup.com',
    pathPrefix: 'uploads',
  },
  github: {
    token: '',
    repo: '',
    branch: 'main',
    pathPrefix: 'images',
    customCdn: 'https://fastly.jsdelivr.net/gh/',
  },

  imageCompress: {
    enabled: true,
    maxWidth: 1600,
    quality: 0.88,
    format: 'auto',
    minSizeKB: 200,
  },

  uploadedCache: {},
};
