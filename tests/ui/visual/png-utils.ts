import { readFile, writeFile } from "node:fs/promises";
import { deflateSync, inflateSync } from "node:zlib";
import type { VisualBounds } from "./reference-manifest.ts";

const PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");

type DecodedPng = {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  bytesPerPixel: number;
  pixels: Buffer;
};

export type PngDimensions = Pick<DecodedPng, "width" | "height">;

function assertPng(buffer: Buffer) {
  if (buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("Expected a PNG image.");
  }
}

function readChunks(buffer: Buffer) {
  assertPng(buffer);
  const chunks: Array<{ type: string; body: Buffer }> = [];
  let offset = PNG_SIGNATURE.length;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const bodyStart = offset + 8;
    const bodyEnd = bodyStart + length;
    if (bodyEnd + 4 > buffer.length) throw new Error("Malformed PNG chunk.");
    chunks.push({
      type: buffer.subarray(offset + 4, offset + 8).toString("ascii"),
      body: buffer.subarray(bodyStart, bodyEnd),
    });
    offset = bodyEnd + 4;
  }
  return chunks;
}

function bytesPerPixel(colorType: number, bitDepth: number) {
  if (bitDepth !== 8) {
    throw new Error(`PNG crop supports 8-bit images only (received ${bitDepth}-bit).`);
  }
  if (colorType === 6) return 4;
  if (colorType === 2) return 3;
  throw new Error(`PNG crop supports RGB/RGBA images only (received color type ${colorType}).`);
}

function paeth(left: number, above: number, upperLeft: number) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  if (aboveDistance <= upperLeftDistance) return above;
  return upperLeft;
}

function decodePng(buffer: Buffer): DecodedPng {
  const chunks = readChunks(buffer);
  const header = chunks.find((chunk) => chunk.type === "IHDR")?.body;
  if (!header || header.length !== 13) throw new Error("PNG has no valid IHDR chunk.");

  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const bitDepth = header[8];
  const colorType = header[9];
  const compression = header[10];
  const filterMethod = header[11];
  const interlace = header[12];
  if (!width || !height) throw new Error("PNG dimensions must be positive.");
  if (compression !== 0 || filterMethod !== 0 || interlace !== 0) {
    throw new Error("PNG crop requires non-interlaced, standard PNG compression.");
  }
  const pixelSize = bytesPerPixel(colorType, bitDepth);
  const rowLength = width * pixelSize;
  const idat = Buffer.concat(chunks.filter((chunk) => chunk.type === "IDAT").map((chunk) => chunk.body));
  if (!idat.length) throw new Error("PNG has no IDAT data.");
  const filtered = inflateSync(idat);
  const expectedLength = height * (rowLength + 1);
  if (filtered.length !== expectedLength) {
    throw new Error(`Unexpected PNG data length: expected ${expectedLength}, received ${filtered.length}.`);
  }

  const pixels = Buffer.alloc(width * height * pixelSize);
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = filtered[sourceOffset];
    sourceOffset += 1;
    const row = pixels.subarray(y * rowLength, (y + 1) * rowLength);
    const prior = y === 0 ? null : pixels.subarray((y - 1) * rowLength, y * rowLength);
    for (let x = 0; x < rowLength; x += 1) {
      const filteredByte = filtered[sourceOffset + x];
      const left = x >= pixelSize ? row[x - pixelSize] : 0;
      const above = prior ? prior[x] : 0;
      const upperLeft = prior && x >= pixelSize ? prior[x - pixelSize] : 0;
      if (filter === 0) row[x] = filteredByte;
      else if (filter === 1) row[x] = (filteredByte + left) & 0xff;
      else if (filter === 2) row[x] = (filteredByte + above) & 0xff;
      else if (filter === 3) row[x] = (filteredByte + Math.floor((left + above) / 2)) & 0xff;
      else if (filter === 4) row[x] = (filteredByte + paeth(left, above, upperLeft)) & 0xff;
      else throw new Error(`Unsupported PNG row filter: ${filter}.`);
    }
    sourceOffset += rowLength;
  }

  return { width, height, bitDepth, colorType, bytesPerPixel: pixelSize, pixels };
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, body: Buffer) {
  const typeBytes = Buffer.from(type, "ascii");
  const payload = Buffer.concat([typeBytes, body]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(payload));
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  return Buffer.concat([length, payload, checksum]);
}

function encodePng(image: DecodedPng) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(image.width, 0);
  header.writeUInt32BE(image.height, 4);
  header[8] = image.bitDepth;
  header[9] = image.colorType;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;
  const rowLength = image.width * image.bytesPerPixel;
  const raw = Buffer.alloc(image.height * (rowLength + 1));
  for (let y = 0; y < image.height; y += 1) {
    const targetOffset = y * (rowLength + 1);
    raw[targetOffset] = 0;
    image.pixels.copy(raw, targetOffset + 1, y * rowLength, (y + 1) * rowLength);
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export function normalizeCropBounds(bounds: VisualBounds, dimensions: PngDimensions): VisualBounds {
  const x = Math.floor(bounds.x);
  const y = Math.floor(bounds.y);
  const width = Math.ceil(bounds.width);
  const height = Math.ceil(bounds.height);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    throw new Error("Critical region bounds must be finite, positive CSS-pixel values.");
  }
  if (x < 0 || y < 0 || x + width > dimensions.width || y + height > dimensions.height) {
    throw new Error(
      `Critical region ${x},${y},${width}x${height} is outside ${dimensions.width}x${dimensions.height}.`,
    );
  }
  return { x, y, width, height };
}

export async function readPngDimensions(filePath: string): Promise<PngDimensions> {
  const image = decodePng(await readFile(filePath));
  return { width: image.width, height: image.height };
}

export async function cropPng(
  sourcePath: string,
  destinationPath: string,
  requestedBounds: VisualBounds,
): Promise<VisualBounds> {
  const source = decodePng(await readFile(sourcePath));
  const bounds = normalizeCropBounds(requestedBounds, source);
  const pixels = Buffer.alloc(bounds.width * bounds.height * source.bytesPerPixel);
  const sourceRowLength = source.width * source.bytesPerPixel;
  const targetRowLength = bounds.width * source.bytesPerPixel;
  for (let row = 0; row < bounds.height; row += 1) {
    const sourceStart = (bounds.y + row) * sourceRowLength + bounds.x * source.bytesPerPixel;
    source.pixels.copy(
      pixels,
      row * targetRowLength,
      sourceStart,
      sourceStart + targetRowLength,
    );
  }
  await writeFile(
    destinationPath,
    encodePng({
      ...source,
      width: bounds.width,
      height: bounds.height,
      pixels,
    }),
  );
  return bounds;
}
