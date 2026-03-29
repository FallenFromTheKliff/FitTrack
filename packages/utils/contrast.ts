function normalizeHex(input: string): string | null {
  const value = input.trim();
  if (!value.startsWith("#")) return null;
  const raw = value.slice(1);
  if (raw.length === 3) {
    return `${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`.toLowerCase();
  }
  if (raw.length >= 6) return raw.slice(0, 6).toLowerCase();
  return null;
}

function parseRgb(input: string): [number, number, number] | null {
  const match = input.trim().match(/^rgba?\(([^)]+)\)$/i);
  if (!match) return null;
  const parts = match[1].split(",").map((value) => Number(value.trim()));
  if (parts.length < 3) return null;
  const [r, g, b] = parts;
  if ([r, g, b].some((value) => Number.isNaN(value))) return null;
  return [r, g, b];
}

function luminanceFromRgb(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function getReadableTextColor(background: string, darkText: string, lightText: string): string {
  const hex = normalizeHex(background);
  if (hex) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if (![r, g, b].some((value) => Number.isNaN(value))) {
      return luminanceFromRgb(r, g, b) < 0.5 ? lightText : darkText;
    }
  }
  const rgb = parseRgb(background);
  if (rgb) {
    return luminanceFromRgb(rgb[0], rgb[1], rgb[2]) < 0.5 ? lightText : darkText;
  }
  return darkText;
}