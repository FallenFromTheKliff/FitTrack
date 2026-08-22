/**
 * Small, reset-only helpers for the deterministic seed.
 *
 * Reset mode starts from an empty database (apart from the reference defaults
 * bootstrapped between domains), so rows with deterministic ids can be written
 * with bulk inserts. Additive mode must keep its existing upsert semantics and
 * therefore never calls these helpers.
 */

export const DEFAULT_SEED_BATCH_SIZE = 500;

type CreateManyDelegate<Row> = {
  createMany(args: { data: Row[]; skipDuplicates?: boolean }): Promise<unknown>;
};

export function chunkSeedRows<Row>(
  rows: readonly Row[],
  batchSize = DEFAULT_SEED_BATCH_SIZE,
) {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
    throw new Error(`Invalid seed batch size: ${batchSize}`);
  }

  const chunks: Row[][] = [];
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    chunks.push(Array.from(rows.slice(offset, offset + batchSize)));
  }
  return chunks;
}

export async function createSeedRowsInBatches<Row>(
  delegate: CreateManyDelegate<Row>,
  rows: readonly Row[],
  options: { batchSize?: number; skipDuplicates?: boolean } = {},
) {
  for (const batch of chunkSeedRows(rows, options.batchSize)) {
    if (batch.length === 0) continue;
    await delegate.createMany({
      data: batch,
      skipDuplicates: options.skipDuplicates ?? true,
    });
  }
}

/**
 * Bounded concurrency for CPU work (for example bcrypt hashing). This is
 * intentionally not used for Prisma writes: one Prisma client query must not
 * be overlapped, and bulk writes already provide the safe throughput gain.
 */
export async function mapSeedWithConcurrency<Input, Output>(
  inputs: readonly Input[],
  limit: number,
  worker: (input: Input, index: number) => Promise<Output>,
) {
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error(`Invalid seed concurrency limit: ${limit}`);
  }

  const output = new Array<Output>(inputs.length);
  let nextIndex = 0;
  const runWorker = async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= inputs.length) return;
      output[index] = await worker(inputs[index], index);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, inputs.length) }, () => runWorker()),
  );
  return output;
}
