import type { PaginatedResult } from "@fittrack/types";

export const BOOKING_HISTORY_PAGE_LIMIT = 100;

type HistoryRecord = {
  id: string | number;
};

type HistoryPaginationMeta = {
  limit: number;
  page: number;
  total: number;
  total_pages: number;
};

type HistoryPageFetcher<T> = (
  page: number,
  limit: number,
  signal?: AbortSignal,
) => Promise<PaginatedResult<T>>;

function isFiniteInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isValidMetadata(meta: unknown): meta is HistoryPaginationMeta {
  if (!meta || typeof meta !== "object") return false;
  const candidate = meta as Partial<HistoryPaginationMeta>;
  return (
    isFiniteInteger(candidate.page) &&
    isFiniteInteger(candidate.limit) &&
    isFiniteInteger(candidate.total) &&
    isFiniteInteger(candidate.total_pages) &&
    candidate.page >= 1 &&
    candidate.limit >= 0 &&
    candidate.total >= 0 &&
    candidate.total_pages >= 0
  );
}

function validatePage(result: PaginatedResult<unknown>, requestedPage: number) {
  const { data, meta } = result;
  if (!Array.isArray(data) || !isValidMetadata(meta)) {
    throw new Error("Unable to load complete booking history: invalid pagination metadata.");
  }

  if (meta.page !== requestedPage) {
    throw new Error("Unable to load complete booking history: pagination did not progress.");
  }

  if (meta.limit > 0 && data.length > meta.limit) {
    throw new Error("Unable to load complete booking history: page size is inconsistent.");
  }

  if (meta.total_pages === 0) {
    if (meta.total !== 0 || data.length > 0) {
      throw new Error("Unable to load complete booking history: empty pagination is inconsistent.");
    }
  } else if (meta.total === 0) {
    if (meta.total_pages !== 1) {
      throw new Error(
        "Unable to load complete booking history: zero-total pagination horizon is invalid.",
      );
    }
    if (data.length > 0) {
      throw new Error(
        "Unable to load complete booking history: zero-total pagination is inconsistent.",
      );
    }
  } else if (meta.limit <= 0) {
    throw new Error(
      "Unable to load complete booking history: pagination metadata is inconsistent.",
    );
  } else if (
    meta.total > 0 &&
    meta.total_pages !== Math.ceil(meta.total / meta.limit)
  ) {
    throw new Error("Unable to load complete booking history: pagination metadata is inconsistent.");
  }

  const rowsBeforePage = (requestedPage - 1) * meta.limit;
  const expectedRows =
    meta.total_pages > 0 && requestedPage <= meta.total_pages
      ? Math.min(meta.limit, Math.max(meta.total - rowsBeforePage, 0))
      : 0;
  if (data.length < expectedRows) {
    throw new Error(
      "Unable to load complete booking history: page data is incomplete.",
    );
  }
}

export async function collectBookingHistory<TApiRecord, TRecord extends HistoryRecord>(
  fetchPage: HistoryPageFetcher<TApiRecord>,
  mapRecord: (record: TApiRecord) => TRecord,
  signal?: AbortSignal,
): Promise<TRecord[]> {
  const firstPage = await fetchPage(1, BOOKING_HISTORY_PAGE_LIMIT, signal);
  validatePage(firstPage, 1);

  const records = new Map<string, TRecord>();
  const appendPage = (page: PaginatedResult<TApiRecord>) => {
    for (const rawRecord of page.data) {
      const record = mapRecord(rawRecord);
      const rawId = (record as { id?: unknown } | null | undefined)?.id;
      if (
        (typeof rawId !== "string" && typeof rawId !== "number") ||
        (typeof rawId === "string" && rawId.trim().length === 0) ||
        (typeof rawId === "number" && !Number.isFinite(rawId))
      ) {
        throw new Error("Unable to load complete booking history: record id is invalid.");
      }
      const id = String(rawId).trim();
      if (!records.has(id)) records.set(id, record);
    }
  };

  appendPage(firstPage);

  const initialPageHorizon = firstPage.meta.total_pages;
  let lastPage = initialPageHorizon;
  for (let pageNumber = 2; pageNumber <= lastPage; pageNumber += 1) {
    const page = await fetchPage(pageNumber, BOOKING_HISTORY_PAGE_LIMIT, signal);
    validatePage(page, pageNumber);
    if (page.meta.total_pages > initialPageHorizon) {
      throw new Error(
        "Unable to load complete booking history: pagination grew during loading.",
      );
    }
    appendPage(page);

    // A concurrent delete may shrink the history. A growth claim beyond the
    // initial horizon is rejected above so the caller can retry from page 1.
    lastPage = page.meta.total_pages;
  }

  return [...records.values()];
}
