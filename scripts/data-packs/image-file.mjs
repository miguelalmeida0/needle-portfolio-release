import fs from 'node:fs/promises';
import path from 'node:path';
import { sha256File } from './hashing.mjs';

const MIN_IMAGE_BYTES = 1_024;

export async function inspectImage(filePath) {
  const stats = await fs.stat(filePath);
  if (!stats.isFile() || stats.size < MIN_IMAGE_BYTES) throw new Error(`Image is too small: ${filePath}`);
  const handle = await fs.open(filePath, 'r');
  try {
    const header = Buffer.alloc(Math.min(256 * 1024, stats.size));
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const bytes = header.subarray(0, bytesRead);
    const format = detectFormat(bytes);
    if (!format) throw new Error(`Unsupported or invalid image: ${filePath}`);
    const dimensions = imageDimensions(bytes, format);
    if (!dimensions || dimensions.width < 32 || dimensions.height < 32) {
      throw new Error(`Image dimensions are invalid: ${filePath}`);
    }
    return {
      format,
      extension: extensionForFormat(format),
      mimeType: mimeForFormat(format),
      width: dimensions.width,
      height: dimensions.height,
      bytes: stats.size,
      sha256: await sha256File(filePath)
    };
  } finally {
    await handle.close();
  }
}

export async function validateImageDownload(filePath, responseHeaders) {
  if (responseHeaders) {
    const type = responseHeaders.get('content-type') ?? '';
    if (type && !type.toLowerCase().startsWith('image/')) {
      throw new Error(`Expected image content but received ${type}.`);
    }
  }
  await inspectImage(filePath);
}

export function safeImageName(objectId, extension) {
  return `${String(objectId).replace(/[^0-9a-z_-]/gi, '_')}.${extension}`;
}

export async function linkOrCopy(source, destination) {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.rm(destination, { force: true });
  try {
    await fs.link(source, destination);
  } catch {
    await fs.copyFile(source, destination);
  }
}

function detectFormat(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 6 && (bytes.subarray(0, 6).toString('ascii') === 'GIF87a' || bytes.subarray(0, 6).toString('ascii') === 'GIF89a')) return 'gif';
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

function imageDimensions(bytes, format) {
  if (format === 'png' && bytes.length >= 24) return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (format === 'gif' && bytes.length >= 10) return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  if (format === 'jpeg') return jpegDimensions(bytes);
  if (format === 'webp') return webpDimensions(bytes);
  return null;
}

function jpegDimensions(bytes) {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > bytes.length) break;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (offset + 7 > bytes.length) break;
      return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    }
    offset += length;
  }
  return null;
}

function webpDimensions(bytes) {
  const subtype = bytes.subarray(12, 16).toString('ascii');
  if (subtype === 'VP8X' && bytes.length >= 30) {
    return {
      width: 1 + bytes.readUIntLE(24, 3),
      height: 1 + bytes.readUIntLE(27, 3)
    };
  }
  if (subtype === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) {
    const bits = bytes.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (subtype === 'VP8 ' && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
  return null;
}

function extensionForFormat(format) {
  return format === 'jpeg' ? 'jpg' : format;
}

function mimeForFormat(format) {
  return format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
}
