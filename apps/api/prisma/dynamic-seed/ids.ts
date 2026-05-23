import { v5 as uuidv5 } from 'uuid';

export const DYNAMIC_SEED_NAMESPACE = '7ddc1b44-28e5-45e0-bb36-6c080043fd60';
export const DYNAMIC_SEED_MARKER = 'fittrack-dynamic-seed';

export function seedId(key: string) {
  return uuidv5(`${DYNAMIC_SEED_MARKER}:${key}`, DYNAMIC_SEED_NAMESPACE);
}

export function seedExternalId(key: string) {
  return `${DYNAMIC_SEED_MARKER}:${key}`;
}
