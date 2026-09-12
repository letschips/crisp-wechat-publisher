import type { ImageCompressConfig } from "../types";

export interface CompressionResult {
  buffer: ArrayBuffer;
  originalSize: number;
  compressedSize: number;
  mimeType: string;
  isCompressed: boolean;
  width?: number;
  height?: number;
}

export function getMimeTypeFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "bmp":
      return "image/bmp";
    default:
      return "application/octet-stream";
  }
}

/**
 * 智能图片无损/高质量压缩处理器
 * 专门解决多张 Mac 高分屏大截图在导出 Base64 或上传图床时超出微信公众号 10MB 限制的问题。
 */
export async function compressImage(
  fileName: string,
  buffer: ArrayBuffer,
  options?: Partial<ImageCompressConfig>
): Promise<CompressionResult> {
  const originalSize = buffer.byteLength;
  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  // 1. 保护性跳过：GIF 动图与 SVG 矢量图绝不经 Canvas 重编码
  if (ext === "gif" || ext === "svg") {
    return {
      buffer,
      originalSize,
      compressedSize: originalSize,
      mimeType: getMimeTypeFromExt(ext),
      isCompressed: false,
    };
  }

  // 2. 检查是否开启压缩与触发阈值
  const isEnabled = options?.enabled ?? true;
  const minSizeKB = options?.minSizeKB ?? 200;
  if (!isEnabled || (minSizeKB > 0 && originalSize < minSizeKB * 1024)) {
    return {
      buffer,
      originalSize,
      compressedSize: originalSize,
      mimeType: getMimeTypeFromExt(ext),
      isCompressed: false,
    };
  }

  // 3. 运行环境检查（测试/Node 环境优雅降级）
  if (typeof document === "undefined" || typeof Image === "undefined") {
    return {
      buffer,
      originalSize,
      compressedSize: originalSize,
      mimeType: getMimeTypeFromExt(ext),
      isCompressed: false,
    };
  }

  try {
    const inputMime = getMimeTypeFromExt(ext);
    const blob = new Blob([buffer], { type: inputMime });

    const img = await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const el = new Image();
      el.onload = () => {
        URL.revokeObjectURL(url);
        resolve(el);
      };
      el.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      el.src = url;
    });

    const origWidth = img.naturalWidth || img.width;
    const origHeight = img.naturalHeight || img.height;

    if (!origWidth || !origHeight) {
      return {
        buffer,
        originalSize,
        compressedSize: originalSize,
        mimeType: inputMime,
        isCompressed: false,
      };
    }

    // 计算缩放后目标尺寸
    const maxWidth = options?.maxWidth ?? 1600;
    let targetWidth = origWidth;
    let targetHeight = origHeight;

    if (maxWidth > 0 && origWidth > maxWidth) {
      const scale = maxWidth / origWidth;
      targetWidth = Math.round(maxWidth);
      targetHeight = Math.round(origHeight * scale);
    }

    // 决定目标格式与质量
    const strategy = options?.format ?? "auto";
    let targetMime = "image/jpeg";
    if (strategy === "png") {
      targetMime = "image/png";
    } else if (strategy === "jpeg") {
      targetMime = "image/jpeg";
    } else {
      // "auto" 策略：对于公众号阅读场景，截图和照片转高质量 JPEG 带来最具决定性的体积缩减
      targetMime = "image/jpeg";
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return {
        buffer,
        originalSize,
        compressedSize: originalSize,
        mimeType: inputMime,
        isCompressed: false,
      };
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // 微信公众号正文默认底色为纯白，转 JPEG 时铺垫白底，消除透明阴影变黑
    if (targetMime === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const quality = Math.min(Math.max(options?.quality ?? 0.88, 0.1), 1.0);
    const compressedBlob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), targetMime, quality);
    });

    if (!compressedBlob) {
      return {
        buffer,
        originalSize,
        compressedSize: originalSize,
        mimeType: inputMime,
        isCompressed: false,
      };
    }

    const compressedBuffer = await compressedBlob.arrayBuffer();

    // 严谨兜底：如果未缩减尺寸且压缩后反而更大，回退保留原图
    if (compressedBuffer.byteLength >= originalSize && targetWidth === origWidth && targetMime === inputMime) {
      return {
        buffer,
        originalSize,
        compressedSize: originalSize,
        mimeType: inputMime,
        isCompressed: false,
      };
    }

    return {
      buffer: compressedBuffer,
      originalSize,
      compressedSize: compressedBuffer.byteLength,
      mimeType: targetMime,
      isCompressed: true,
      width: targetWidth,
      height: targetHeight,
    };
  } catch (err) {
    console.warn("[Crisp WeChat] 图片无损压缩异常，已安全回退原图:", err);
    return {
      buffer,
      originalSize,
      compressedSize: originalSize,
      mimeType: getMimeTypeFromExt(ext),
      isCompressed: false,
    };
  }
}
