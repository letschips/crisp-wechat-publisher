import { App, TFile, Notice } from 'obsidian';
import type { PluginSettings } from '../types';
import type { ImageUploader } from '../uploader';
import { getMarkdownProtectedRanges, isIndexInRanges } from '../core/markdown-context';

export interface ImageReference {
  rawMatch: string;
  linkPath: string;
  altText: string;
  width?: string;
  isWikiLink: boolean;
}

export interface ImageResolutionOptions {
  /** Resolve directly to an Obsidian resource URL for zero-copy local previews. */
  localResourceUrl?: (file: TFile) => string;
}

// Compute a stable content hash for upload-cache keys.
export async function computeBufferSHA256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function extractImages(markdown: string): ImageReference[] {
  const refs: ImageReference[] = [];
  const codeRanges = getMarkdownProtectedRanges(markdown);

  // 1. Wikilinks images: ![[path/to/file.png|alt or size]] or ![[file.png]]
  const wikiRegex = /!\[\[([^\]]+)\]\]/g;
  let match;
  while ((match = wikiRegex.exec(markdown)) !== null) {
    if (isIndexInRanges(match.index, codeRanges)) continue;
    const rawInner = match[1].trim();
    const parts = rawInner.split('|');
    const linkPath = parts[0].trim();
    let altText = '';
    let width: string | undefined;

    if (parts.length > 1) {
      for (const part of parts.slice(1)) {
        const extra = part.trim();
        if (/^\d+(?:x\d+)?$/.test(extra)) {
          width = extra.split('x')[0];
        } else if (extra && !altText) {
          altText = extra;
        }
      }
    }

    refs.push({
      rawMatch: match[0],
      linkPath,
      altText,
      width,
      isWikiLink: true,
    });
  }

  // 2. Standard Markdown images: ![alt](url or local/path)
  const mdImgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  while ((match = mdImgRegex.exec(markdown)) !== null) {
    if (isIndexInRanges(match.index, codeRanges)) continue;
    const rawAlt = match[1].trim();
    const linkPath = match[2].trim();

    // Only capture if not already a web URL or data URI
    if (!linkPath.startsWith('http://') && !linkPath.startsWith('https://') && !linkPath.startsWith('data:')) {
      let altText = rawAlt;
      let width: string | undefined;

      if (rawAlt.includes('|')) {
        const parts = rawAlt.split('|');
        altText = parts[0].trim();
        const extra = parts[1].trim();
        if (/^\d+(?:x\d+)?$/.test(extra)) {
          width = extra.split('x')[0];
        }
      }

      refs.push({
        rawMatch: match[0],
        linkPath,
        altText,
        width,
        isWikiLink: false,
      });
    }
  }

  return refs;
}

export function findTargetTFile(app: App, linkPath: string, sourcePath: string): TFile | null {
  // Strip query/hash e.g. image.png#center
  const cleanLink = linkPath.split('#')[0].split('?')[0].trim();
  let decodedLink = cleanLink;
  try {
    decodedLink = decodeURIComponent(cleanLink);
  } catch {
    // Keep the literal path. A malformed escape should only leave this image unresolved.
  }

  // 1. First attempt with getFirstLinkpathDest
  let targetFile = app.metadataCache.getFirstLinkpathDest(cleanLink, sourcePath);
  if (targetFile instanceof TFile) return targetFile;

  // 2. Attempt with decoded link
  targetFile = app.metadataCache.getFirstLinkpathDest(decodedLink, sourcePath);
  if (targetFile instanceof TFile) return targetFile;

  // 3. Attempt direct getFileByPath
  const directFile = app.vault.getAbstractFileByPath(cleanLink);
  if (directFile instanceof TFile) return directFile;

  const directDecoded = app.vault.getAbstractFileByPath(decodedLink);
  if (directDecoded instanceof TFile) return directDecoded;

  // 4. Attempt relative to source file parent folder
  const currentFile = app.vault.getAbstractFileByPath(sourcePath);
  if (currentFile instanceof TFile && currentFile.parent) {
    const relativeClean = cleanLink.replace(/^\.\//, '');
    const parentPath = currentFile.parent.path === '/' ? '' : `${currentFile.parent.path}/`;
    const combinedPath = `${parentPath}${relativeClean}`;
    const combinedFile = app.vault.getAbstractFileByPath(combinedPath);
    if (combinedFile instanceof TFile) return combinedFile;
  }

  return null;
}

export async function resolveAndUploadImages(
  markdown: string,
  sourcePath: string,
  app: App,
  settings: PluginSettings,
  uploader: ImageUploader,
  saveSettings: () => Promise<void>,
  options: ImageResolutionOptions = {}
): Promise<{ processedMarkdown: string; uploadedCount: number; cachedCount: number }> {
  const images = extractImages(markdown);

  if (images.length === 0) {
    return { processedMarkdown: markdown, uploadedCount: 0, cachedCount: 0 };
  }

  let processedMarkdown = markdown;
  let uploadedCount = 0;
  let cachedCount = 0;
  let cacheModified = false;
  const cacheEnabled = settings.uploaderType !== 'none' && settings.uploaderType !== 'base64';
  const cacheNamespace = getUploadCacheNamespace(settings);

  for (const img of images) {
    const targetFile = findTargetTFile(app, img.linkPath, sourcePath);

    if (!targetFile) {
      console.warn(`[Crisp WeChat] Could not resolve image: ${img.linkPath}`);
      continue;
    }

    try {
      let cdnUrl = options.localResourceUrl?.(targetFile);

      if (!cdnUrl) {
        const buffer = await app.vault.readBinary(targetFile);
        const hash = await computeBufferSHA256(buffer);
        const cacheKey = `${cacheNamespace}:${hash}`;
        cdnUrl = cacheEnabled ? settings.uploadedCache[cacheKey] : undefined;

        if (cdnUrl) {
          cachedCount++;
        } else {
          cdnUrl = await uploader.upload(targetFile.name, buffer);
          if (cacheEnabled) {
            settings.uploadedCache[cacheKey] = cdnUrl;
            // Remove legacy, destination-agnostic entries when encountered.
            if (hash in settings.uploadedCache) delete settings.uploadedCache[hash];
            cacheModified = true;
          }
          uploadedCount++;
        }
      }

      // Build replacement tag (preserve width if specified)
      let replacement: string;
      const alt = img.altText || targetFile.basename;
      if (img.width) {
        replacement = `<img src="${cdnUrl}" alt="${alt}" style="display: block; max-width: ${img.width}px; width: 100%; height: auto; margin: 1.5em auto; border-radius: 8px;" />`;
      } else {
        replacement = `![${alt}](${cdnUrl})`;
      }

      processedMarkdown = processedMarkdown.split(img.rawMatch).join(replacement);
    } catch (err) {
      console.error(`[Crisp WeChat] Failed to process image ${targetFile.name}:`, err);
      new Notice(`⚠️ 图片上传失败: ${targetFile.name} (${err instanceof Error ? err.message : String(err)})`);
    }
  }

  if (cacheModified) {
    await saveSettings();
  }

  return { processedMarkdown, uploadedCount, cachedCount };
}

function getUploadCacheNamespace(settings: PluginSettings): string {
  switch (settings.uploaderType) {
    case 's3':
      return `s3:${settings.s3.endpoint}:${settings.s3.bucket}:${settings.s3.customDomain || ''}:${settings.s3.pathPrefix || ''}`;
    case 'oss':
      return `oss:${settings.oss.region}:${settings.oss.bucket}:${settings.oss.customDomain || ''}:${settings.oss.pathPrefix || ''}`;
    case 'cos':
      return `cos:${settings.cos.region}:${settings.cos.bucket}:${settings.cos.customDomain || ''}:${settings.cos.pathPrefix || ''}`;
    case 'qiniu':
      return `qiniu:${settings.qiniu.bucket}:${settings.qiniu.domain}:${settings.qiniu.pathPrefix || ''}`;
    case 'github':
      return `github:${settings.github.repo}:${settings.github.branch}:${settings.github.customCdn || ''}:${settings.github.pathPrefix || ''}`;
    default:
      return 'base64';
  }
}
