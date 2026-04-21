export const DEFAULT_UPLOAD_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
export const DEFAULT_R2_STORAGE_LIMIT_BYTES = 10_000_000_000;
export const DEFAULT_R2_MIN_FREE_BYTES = 1_000_000_000;

export function parseEnvInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseEnvBoolean(
  value: string | undefined,
  fallback = false,
): boolean {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  return fallback;
}

export function getUploadMaxFileSizeBytes(): number {
  return parseEnvInteger(
    process.env.UPLOAD_MAX_FILE_SIZE_BYTES,
    DEFAULT_UPLOAD_MAX_FILE_SIZE_BYTES,
  );
}
