import assert from "node:assert/strict";
import test from "node:test";

type Standing = {
  memberName: string;
  rankPosition: number;
  totalXp: number;
  userId: string;
};

const standings: Standing[] = Array.from({ length: 25 }, (_, index) => ({
  memberName: index === 17 ? "Rank Eighteen" : `Member ${index + 1}`,
  rankPosition: index + 1,
  totalXp: 5_000 - index * 100,
  userId: `member-${index + 1}`,
}));

const modulePath = "./ranking-governance.ts";

test("search, filters, clearing, and pagination preserve canonical ranks", async () => {
  const { getCanonicalSeasonStandingRank } = await import(modulePath);
  const ranks = (rows: Standing[]) =>
    rows.map((standing) => getCanonicalSeasonStandingRank(standing));
  assert.deepEqual(
    ranks(standings.filter((row) => row.memberName === "Rank Eighteen")),
    [18],
  );
  assert.deepEqual(
    ranks(
      standings.filter((row) => ["member-4", "member-18"].includes(row.userId)),
    ),
    [4, 18],
  );
  assert.deepEqual(
    ranks(standings),
    Array.from({ length: 25 }, (_, index) => index + 1),
  );
  assert.deepEqual(
    ranks(standings.slice(10, 20)),
    [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  );
});

test("competition ties and refetched EXP ranks remain server canonical", async () => {
  const { getCanonicalSeasonStandingRank } = await import(modulePath);
  const ranks = (rows: Standing[]) =>
    rows.map((standing) => getCanonicalSeasonStandingRank(standing));
  const tied = [
    { ...standings[0], rankPosition: 1, totalXp: 5_000 },
    { ...standings[1], rankPosition: 1, totalXp: 5_000 },
    { ...standings[2], rankPosition: 3, totalXp: 4_800 },
  ];
  assert.deepEqual(ranks(tied), [1, 1, 3]);

  const beforeRefetch = { ...standings[17], rankPosition: 18 };
  const afterExpRefetch = {
    ...beforeRefetch,
    rankPosition: 17,
    totalXp: 3_450,
  };
  assert.equal(getCanonicalSeasonStandingRank(beforeRefetch), 18);
  assert.equal(getCanonicalSeasonStandingRank(afterExpRefetch), 17);
});
