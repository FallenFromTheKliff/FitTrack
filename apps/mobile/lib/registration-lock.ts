export type RegistrationLockMetadata = {
  retryAfterSeconds: number;
  lockedUntil: string;
};

export function getRegistrationLockExpiry(lock: RegistrationLockMetadata) {
  const lockedUntil = Date.parse(lock.lockedUntil);
  if (Number.isFinite(lockedUntil)) return lockedUntil;

  return Date.now() + Math.max(0, lock.retryAfterSeconds) * 1000;
}

export function getRegistrationLockRemainingSeconds(expiresAt: number) {
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
}

export function formatRegistrationLockCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
