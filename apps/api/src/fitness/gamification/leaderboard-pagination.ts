export interface StableLeaderboardCursor {
  snapshot: string;
  score: number;
  tie_breaker: string;
  user_id: string;
}

export function encodeLeaderboardCursor(
  cursor: StableLeaderboardCursor,
): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeLeaderboardCursor(
  value: string | undefined,
): StableLeaderboardCursor | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as Partial<StableLeaderboardCursor>;
    if (
      typeof parsed.snapshot !== 'string' ||
      !Number.isSafeInteger(parsed.score) ||
      typeof parsed.tie_breaker !== 'string' ||
      typeof parsed.user_id !== 'string'
    ) {
      return null;
    }
    return parsed as StableLeaderboardCursor;
  } catch {
    return null;
  }
}

export function isAfterLeaderboardCursor(
  row: { score: number; tie_breaker: string; user_id: string },
  cursor: StableLeaderboardCursor,
): boolean {
  return (
    row.score < cursor.score ||
    (row.score === cursor.score &&
      (row.tie_breaker > cursor.tie_breaker ||
        (row.tie_breaker === cursor.tie_breaker &&
          row.user_id > cursor.user_id)))
  );
}
