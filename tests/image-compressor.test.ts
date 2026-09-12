import test from "node:test";
import assert from "node:assert/strict";
import { compressImage, getMimeTypeFromExt } from "../src/preprocessor/image-compressor";
import { resolveAndUploadImages } from "../src/preprocessor/image-resolver";
import { DEFAULT_SETTINGS } from "../src/types";

test("getMimeTypeFromExt maps common extensions correctly", () => {
  assert.equal(getMimeTypeFromExt("png"), "image/png");
  assert.equal(getMimeTypeFromExt("jpg"), "image/jpeg");
  assert.equal(getMimeTypeFromExt("jpeg"), "image/jpeg");
  assert.equal(getMimeTypeFromExt("gif"), "image/gif");
  assert.equal(getMimeTypeFromExt("webp"), "image/webp");
  assert.equal(getMimeTypeFromExt("svg"), "image/svg+xml");
});

test("compressImage skips animated GIF and SVG to prevent destruction", async () => {
  const fakeGif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]).buffer;
  const gifResult = await compressImage("banner.gif", fakeGif, { enabled: true, minSizeKB: 0 });
  assert.equal(gifResult.isCompressed, false);
  assert.equal(gifResult.mimeType, "image/gif");
  assert.equal(gifResult.buffer, fakeGif);

  const fakeSvg = new TextEncoder().encode("<svg></svg>").buffer;
  const svgResult = await compressImage("diagram.svg", fakeSvg, { enabled: true, minSizeKB: 0 });
  assert.equal(svgResult.isCompressed, false);
  assert.equal(svgResult.mimeType, "image/svg+xml");
  assert.equal(svgResult.buffer, fakeSvg);
});

test("compressImage respects enabled: false flag", async () => {
  const fakePng = new Uint8Array([1, 2, 3, 4, 5]).buffer;
  const result = await compressImage("screenshot.png", fakePng, { enabled: false });
  assert.equal(result.isCompressed, false);
  assert.equal(result.buffer, fakePng);
});

test("compressImage skips images below minSizeKB threshold", async () => {
  const smallPng = new Uint8Array(100 * 1024).buffer; // 100KB
  const result = await compressImage("icon.png", smallPng, { enabled: true, minSizeKB: 200 });
  assert.equal(result.isCompressed, false);
  assert.equal(result.originalSize, 100 * 1024);
  assert.equal(result.buffer, smallPng);
});

test("compressImage gracefully returns uncompressed buffer in non-DOM environment without crashing", async () => {
  const largePng = new Uint8Array(500 * 1024).buffer; // 500KB
  const result = await compressImage("large.png", largePng, { enabled: true, minSizeKB: 200 });
  assert.equal(result.isCompressed, false);
  assert.equal(result.originalSize, 500 * 1024);
  assert.equal(result.compressedSize, 500 * 1024);
  assert.equal(result.buffer, largePng);
});
