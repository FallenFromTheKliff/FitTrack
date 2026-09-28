import { createApiClient } from "@fittrack/api-client";
import {
  fitnessMemberMuscleDefinitionsQueryOptions,
  fitnessMuscleLeaderboardQueryOptions,
} from "@fittrack/query";
import type {
  FitnessMuscleLeaderboardEntryRecord,
  FitnessSeasonHistoryRecord,
} from "@fittrack/types";

import {
  retainMuscleSelection,
  resolveSeasonHistoryId,
  resolveSeasonHistoryMuscleOptions,
  resolveSeasonHistoryMuscleRows,
} from "./seasonHistorySelection";

const SEASON_ID = "33333333-3333-1333-8333-333333333333";
const SECOND_SEASON_ID = "44444444-4444-7444-8444-444444444444";

function makeSeason(
  seasonId: string,
  title: string,
): FitnessSeasonHistoryRecord {
  return {
    closedAt: null,
    endsAt: "2026-06-30T23:59:59.000Z",
    seasonId,
    startsAt: "2026-04-01T00:00:00.000Z",
    title,
    topPerformers: [],
  };
}

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function runSeasonHistoryRegression() {
  const seasons = [
    makeSeason(SEASON_ID, "FitTrack Performance Season"),
    makeSeason(SECOND_SEASON_ID, "FitTrack Foundation Season"),
  ];
  const selectedSeasonId = resolveSeasonHistoryId(
    seasons,
    "FitTrack Foundation Season",
  );
  const changedSeasonId = resolveSeasonHistoryId(
    seasons,
    "FitTrack Performance Season",
  );

  assertEqual(
    selectedSeasonId,
    SECOND_SEASON_ID,
    "season labels resolve to the canonical UUID",
  );
  assertEqual(
    changedSeasonId,
    SEASON_ID,
    "changing seasons resolves to the next canonical UUID",
  );
  assertEqual(
    resolveSeasonHistoryId(seasons, SECOND_SEASON_ID),
    SECOND_SEASON_ID,
    "canonical UUID selections stay stable",
  );
  const memberDefinitions = [
    { key: "chest", isActive: true, name: "Chest" },
    { key: "glutes", isActive: true, name: "Glutes" },
    {
      key: "latissimus_dorsi",
      isActive: true,
      name: "Latissimus Dorsi",
    },
    { key: "legacy_muscle", isActive: false, name: "Legacy Muscle" },
  ];
  const rankingMuscleOptions = resolveSeasonHistoryMuscleOptions(memberDefinitions);
  const seasonHistoryMuscleOptions =
    resolveSeasonHistoryMuscleOptions(memberDefinitions);
  assertDeepEqual(
    rankingMuscleOptions,
    ["chest", "glutes", "latissimus_dorsi"],
    "active definitions preserve every database key and exclude archived keys",
  );
  assertDeepEqual(
    seasonHistoryMuscleOptions,
    rankingMuscleOptions,
    "leaderboard and season history receive the same complete active key set",
  );
  assertDeepEqual(
    resolveSeasonHistoryMuscleOptions(),
    [],
    "missing member definitions do not fall back to static canonical keys",
  );
  assertEqual(
    retainMuscleSelection(rankingMuscleOptions, "latissimus_dorsi"),
    "latissimus_dorsi",
    "selected muscle is retained when the filter disclosure collapses",
  );
  assertEqual(
    retainMuscleSelection(rankingMuscleOptions, "legacy_muscle"),
    "chest",
    "invalid selections move to the first active database key",
  );

  const priorRows: FitnessMuscleLeaderboardEntryRecord[] = [
    {
      displayName: "Chest athlete",
      lastEarnedAt: null,
      muscleKey: "chest",
      rankPosition: 1,
      scope: "season",
      seasonId: SEASON_ID,
      seasonTitle: "FitTrack Performance Season",
      userId: "member-1",
      xpPoints: 100,
    },
  ];
  assertDeepEqual(
    resolveSeasonHistoryMuscleRows(priorRows, true),
    [],
    "switching muscles clears cached rows while the next request is fetching",
  );
  assertDeepEqual(
    resolveSeasonHistoryMuscleRows(priorRows, false),
    priorRows,
    "completed muscle responses preserve the empty-state contract",
  );
  assertDeepEqual(
    resolveSeasonHistoryMuscleRows(undefined, false),
    [],
    "muscles without standings remain empty",
  );

  if (!selectedSeasonId || !changedSeasonId) {
    throw new Error("Expected selected season UUIDs");
  }

  const definitionRequests: Array<{
    url: string;
    params?: Record<string, unknown>;
  }> = [];
  const definitionTransport = {
    get: async (
      url: string,
      config?: { params?: Record<string, unknown> },
    ) => {
      definitionRequests.push({ url, params: config?.params });
      return { data: { data: [] } };
    },
  } as never;
  const definitionApi = createApiClient({ transport: definitionTransport });
  const definitionQuery = fitnessMemberMuscleDefinitionsQueryOptions(definitionApi);
  if (typeof definitionQuery.queryFn !== "function") {
    throw new Error("Expected a member muscle definitions query function");
  }
  await definitionQuery.queryFn({} as never);
  assertDeepEqual(
    definitionRequests,
    [{ url: "/fitness/member/muscle-definitions" }],
    "member muscle definitions use a dedicated endpoint without admin controls",
  );

  for (const muscleKey of ["chest", "glutes"]) {
    const requests: Array<{
      url: string;
      params?: Record<string, unknown>;
    }> = [];
    const transport = {
      get: async (
        url: string,
        config?: { params?: Record<string, unknown> },
      ) => {
        requests.push({ url, params: config?.params });
        return {
          data: {
            data: [],
            meta: { page: 1, limit: 10, total: 0, total_pages: 0 },
          },
        };
      },
    } as never;

    const api = createApiClient({ transport });
    const invokeSeasonQuery = async (seasonId: string) => {
      const query = fitnessMuscleLeaderboardQueryOptions(api, "member-1", {
        limit: 10,
        muscleKey,
        scope: "season",
        seasonId,
      });
      if (typeof query.queryFn !== "function") {
        throw new Error("Expected a muscle leaderboard query function");
      }
      await query.queryFn({} as never);
      return query.queryKey;
    };

    const firstQueryKey = await invokeSeasonQuery(selectedSeasonId);
    const changedQueryKey = await invokeSeasonQuery(changedSeasonId);
    const retryQueryKey = await invokeSeasonQuery(changedSeasonId);

    assertDeepEqual(
      [firstQueryKey, changedQueryKey, retryQueryKey],
      [
        [
          "fitness",
          "muscle-leaderboard",
          "member-1",
          { limit: 10, muscleKey, scope: "season", seasonId: SECOND_SEASON_ID },
        ],
        [
          "fitness",
          "muscle-leaderboard",
          "member-1",
          { limit: 10, muscleKey, scope: "season", seasonId: SEASON_ID },
        ],
        [
          "fitness",
          "muscle-leaderboard",
          "member-1",
          { limit: 10, muscleKey, scope: "season", seasonId: SEASON_ID },
        ],
      ],
      `query keys change with the selected season and remain stable on retry for ${muscleKey}`,
    );

    const invalidQuery = fitnessMuscleLeaderboardQueryOptions(api, "member-1", {
      limit: 10,
      muscleKey,
      scope: "season",
      seasonId: "FitTrack Foundation Season",
    });
    if (typeof invalidQuery.queryFn !== "function") {
      throw new Error("Expected an invalid-season query function");
    }
    let invalidSeasonError: Error | null = null;
    try {
      await invalidQuery.queryFn({} as never);
    } catch (error) {
      invalidSeasonError = error instanceof Error ? error : new Error(String(error));
    }
    assertEqual(
      invalidSeasonError?.message,
      "season_id must be a valid UUID",
      `non-UUID season labels fail before transport for ${muscleKey}`,
    );

    assertDeepEqual(
      requests,
      [
        {
          url: "/fitness/muscle-leaderboard",
          params: {
            scope: "season",
            muscle_key: muscleKey,
            limit: 10,
            season_id: SECOND_SEASON_ID,
          },
        },
        {
          url: "/fitness/muscle-leaderboard",
          params: {
            scope: "season",
            muscle_key: muscleKey,
            limit: 10,
            season_id: SEASON_ID,
          },
        },
        {
          url: "/fitness/muscle-leaderboard",
          params: {
            scope: "season",
            muscle_key: muscleKey,
            limit: 10,
            season_id: SEASON_ID,
          },
        },
      ],
      `season UUID serialization through the query boundary for ${muscleKey}`,
    );
  }
}

void runSeasonHistoryRegression();
