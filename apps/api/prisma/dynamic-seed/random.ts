export class SeedRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next() {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  int(min: number, max: number) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  number(min: number, max: number, precision = 2) {
    const factor = 10 ** precision;
    return Math.round((min + this.next() * (max - min)) * factor) / factor;
  }

  bool(chance = 0.5) {
    return this.next() < chance;
  }

  pick<T>(items: readonly T[]) {
    if (!items.length) {
      throw new Error('Cannot pick from an empty seed list.');
    }
    return items[this.int(0, items.length - 1)];
  }

  rotate<T>(items: readonly T[], index: number) {
    if (!items.length) {
      throw new Error('Cannot rotate an empty seed list.');
    }
    return items[index % items.length];
  }
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}
