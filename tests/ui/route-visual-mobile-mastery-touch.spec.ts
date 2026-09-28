import { expect, test, type Locator, type Page, type Route, type TestInfo } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  auditConventionalLayout,
  stabilizeVisualPage,
  type VisualLayoutAudit,
} from "./visual-stabilizer";

const MOBILE_BASE_URL = process.env.PLAYWRIGHT_MOBILE_BASE_URL ?? "http://127.0.0.1:8081";
const FIXED_NOW = Date.parse("2026-09-08T08:00:00.000Z");
const MEMBER_ID = "66666666-6666-4666-8666-666666666666";
const ACTIVE_SEASON_ID = "mastery-touch-season-active";
const CLOSED_SEASON_ID = "mastery-touch-season-closed";
const JOURNEY_SEASON_ONE_ID = "33333333-3333-4333-8333-333333333333";
const JOURNEY_SEASON_TWO_ID = "44444444-4444-4444-8444-444444444444";

type MasteryFixtureState = {
  claimRequests: number;
  consoleErrors: string[];
  mutations: Array<{ body: unknown; method: string; path: string }>;
  observedRequests: string[];
  unhandled: string[];
  adminLifecycleStage: "below" | "unlocked" | "claimed";
};

type MasteryFixtureOptions = {
  additionalClaimable?: boolean;
  adminLifecycle?: boolean;
  claimMode?: "failureOnce" | "pending" | "success";
  longClaimTitle?: string;
  seasonHistoryJourney?: boolean;
};

type ScrollMetrics = {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
  scrollableCount: number;
};

function newFixtureState(): MasteryFixtureState {
  return {
    claimRequests: 0,
    consoleErrors: [],
    mutations: [],
    observedRequests: [],
    unhandled: [],
    adminLifecycleStage: "below",
  };
}

function apiResponse(data: unknown) {
  return JSON.stringify({ data });
}

async function fulfill(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    body: apiResponse(data),
    contentType: "application/json",
    status,
  });
}

async function fulfillPaginated(
  route: Route,
  records: unknown[],
  meta: { limit: number; page: number; total: number; total_pages: number },
) {
  await route.fulfill({
    body: JSON.stringify({ data: records, meta }),
    contentType: "application/json",
    status: 200,
  });
}

function memberProfile() {
  return {
    email: "mastery-touch-member@fittrack.test",
    email_verified: true,
    has_accepted_privacy: true,
    id: MEMBER_ID,
    membership_card: {
      activated_at: "2026-09-01T00:00:00.000Z",
      purchased_at: "2026-09-01T00:00:00.000Z",
      source: "fixture",
      status: "active",
      verified_at: "2026-09-01T00:00:00.000Z",
    },
    phone_no: "+639171234569",
    profile: {
      activity_level: "moderate",
      date_of_birth: "1994-05-20",
      first_name: "Mastery",
      gender: "female",
      height_cm: 165,
      last_name: "Touch",
      fitness_goal: "maintenance",
      weight_kg: 60,
    },
    role: "USER",
    status: "active",
  };
}

function activeSeason() {
  return {
    ends_at: "2026-09-30T23:59:59.000Z",
    id: ACTIVE_SEASON_ID,
    starts_at: "2026-08-01T00:00:00.000Z",
    status: "active",
    title: "Autumn Strength Season",
  };
}

function masteryRecords() {
  return [
    {
      created_at: "2026-08-01T00:00:00.000Z",
      id: "mastery-touch-shoulders",
      last_ranked_at: "2026-09-08T06:00:00.000Z",
      muscle_group: "Shoulders",
      rank: "gold",
      rank_display: "Gold",
      total_volume_kg: "1680.5",
      updated_at: "2026-09-08T06:00:00.000Z",
      user_id: MEMBER_ID,
      xp_points: 4800,
    },
    {
      created_at: "2026-08-01T00:00:00.000Z",
      id: "mastery-touch-back",
      last_ranked_at: "2026-09-08T06:00:00.000Z",
      muscle_group: "Back",
      rank: "silver",
      rank_display: "Silver",
      total_volume_kg: "1420.25",
      updated_at: "2026-09-08T06:00:00.000Z",
      user_id: MEMBER_ID,
      xp_points: 3600,
    },
    {
      created_at: "2026-08-01T00:00:00.000Z",
      id: "mastery-touch-legs",
      last_ranked_at: "2026-09-08T06:00:00.000Z",
      muscle_group: "Legs",
      rank: "gold",
      rank_display: "Gold",
      total_volume_kg: "2150",
      updated_at: "2026-09-08T06:00:00.000Z",
      user_id: MEMBER_ID,
      xp_points: 3200,
    },
    {
      created_at: "2026-08-01T00:00:00.000Z",
      id: "mastery-touch-chest",
      last_ranked_at: "2026-09-08T06:00:00.000Z",
      muscle_group: "Chest",
      rank: "bronze",
      rank_display: "Bronze",
      total_volume_kg: "1080.75",
      updated_at: "2026-09-08T06:00:00.000Z",
      user_id: MEMBER_ID,
      xp_points: 2400,
    },
  ];
}

function muscleDefinitions() {
  return [
    {
      aliases: [],
      body_region: "upper",
      created_at: "2026-01-01T00:00:00.000Z",
      icon_asset_key: null,
      icon_key: "dumbbell",
      icon_kind: "library",
      id: "muscle-definition-shoulders",
      is_active: true,
      is_system: true,
      key: "shoulders",
      name: "Shoulders",
      sort_order: 1,
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    {
      aliases: [],
      body_region: "upper",
      created_at: "2026-01-01T00:00:00.000Z",
      icon_asset_key: null,
      icon_key: "dumbbell",
      icon_kind: "library",
      id: "muscle-definition-back",
      is_active: true,
      is_system: true,
      key: "back",
      name: "Back",
      sort_order: 2,
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ];
}

function milestone(
  index: number,
  title: string,
  status: "claimed" | "in_progress" | "unlocked",
  progressValue: number,
  targetValue: number,
) {
  const progressPercent = Math.round((progressValue / targetValue) * 100);
  const unlockedAt = status === "in_progress" ? null : "2026-09-07T08:00:00.000Z";
  return {
    category: "training",
    claimed_at: status === "claimed" ? "2026-09-07T09:00:00.000Z" : null,
    condition_payload: { target: targetValue },
    description: `Confirmed progression toward ${title.toLowerCase()}.`,
    evidence_requirement: "none",
    icon_asset_key: null,
    icon_key: index % 2 === 0 ? "trophy" : "dumbbell",
    icon_kind: "library",
    is_hidden: false,
    latest_evidence_submission: null,
    key: `mastery-touch-milestone-${index}`,
    milestone_definition_id: `mastery-touch-milestone-${index}`,
    progress_percent: progressPercent,
    progress_value: progressValue,
    reward_payload: { xp: 100 + index * 25 },
    status,
    target_value: targetValue,
    title,
    trigger_type: "summary_threshold",
    unlocked_at: unlockedAt,
    updated_at: "2026-09-08T06:00:00.000Z",
    verification_policy: "auto",
  };
}

const ADMIN_MILESTONE_ID = "admin-created-milestone-55555555";
const HIDDEN_EARNED_MILESTONE_ID = "admin-hidden-earned-77777777";
const ADMIN_MILESTONE_TITLE = "Admin Nutrition Goal With A Long Mobile Title";
const HIDDEN_EARNED_MILESTONE_TITLE = "Hidden Earned Admin Reward";

function adminCreatedMilestone(stage: MasteryFixtureState["adminLifecycleStage"]) {
  const record = milestone(
    99,
    ADMIN_MILESTONE_TITLE,
    stage === "below" ? "in_progress" : "unlocked",
    stage === "below" ? 4 : 5,
    5,
  );
  return {
    ...record,
    condition_payload: { metric: "nutrition_logs", target: 5 },
    is_hidden: false,
    key: ADMIN_MILESTONE_ID,
    milestone_definition_id: ADMIN_MILESTONE_ID,
    reward_payload: { badge_tone: "ember", xp_bonus: 350 },
    title: ADMIN_MILESTONE_TITLE,
  };
}

function hiddenEarnedMilestone() {
  const record = milestone(100, HIDDEN_EARNED_MILESTONE_TITLE, "claimed", 5, 5);
  return {
    ...record,
    is_hidden: true,
    key: HIDDEN_EARNED_MILESTONE_ID,
    milestone_definition_id: HIDDEN_EARNED_MILESTONE_ID,
    reward_payload: { xp: 75 },
    title: HIDDEN_EARNED_MILESTONE_TITLE,
  };
}
function milestones(options: MasteryFixtureOptions = {}) {
  const records = [
    milestone(1, "First tracked workout", "claimed", 1, 1),
    milestone(2, options.longClaimTitle ?? "Build a weekly rhythm", "unlocked", 4, 4),
    milestone(3, "Shoulder strength block", "in_progress", 6, 10),
    milestone(4, "Volume builder", "in_progress", 8, 20),
    milestone(5, "Consistency streak", "in_progress", 5, 14),
    milestone(6, "Season starter", "in_progress", 2, 8),
    milestone(7, "Training total", "in_progress", 12, 30),
  ];
  if (options.additionalClaimable) {
    records.push(milestone(8, "Keep the weekly rhythm", "unlocked", 8, 8));
  }
  return records;
}

function leaderboard() {
  return [
    {
      avatar_url: null,
      display_name: "Mastery Touch",
      rank_position: 1,
      total_xp: 14000,
      user_id: MEMBER_ID,
    },
    {
      avatar_url: null,
      display_name: "Jordan Athlete",
      rank_position: 2,
      total_xp: 12650,
      user_id: "77777777-7777-4777-8777-777777777777",
    },
    {
      avatar_url: null,
      display_name: "Taylor Trainer",
      rank_position: 3,
      total_xp: 11100,
      user_id: "88888888-8888-4888-8888-888888888888",
    },
  ];
}

function seasonHistory(includeJourneyData = false) {
  const previousSeasonHistory = [
    {
      closed_at: "2026-08-01T00:00:00.000Z",
      ends_at: "2026-07-31T23:59:59.000Z",
      season_id: CLOSED_SEASON_ID,
      starts_at: "2026-06-01T00:00:00.000Z",
      title: "Summer Foundations",
      top_performers: [
        {
          display_name: "Jordan Athlete",
          rank_position: 1,
          season_points: 3850,
          user_id: "77777777-7777-4777-8777-777777777777",
        },
        {
          display_name: "Mastery Touch",
          rank_position: 2,
          season_points: 3520,
          user_id: MEMBER_ID,
        },
      ],
    },
  ];

  if (!includeJourneyData) return previousSeasonHistory;

  return [
    {
      ...previousSeasonHistory[0],
      season_id: JOURNEY_SEASON_ONE_ID,
    },
    {
      closed_at: "2026-06-01T00:00:00.000Z",
      ends_at: "2026-05-31T23:59:59.000Z",
      season_id: JOURNEY_SEASON_TWO_ID,
      starts_at: "2026-04-01T00:00:00.000Z",
      title: "Spring Strength",
      top_performers: [
        {
          display_name: "Taylor Trainer",
          rank_position: 1,
          season_points: 4920,
          user_id: "88888888-8888-4888-8888-888888888888",
        },
        {
          display_name: "Mastery Touch",
          rank_position: 2,
          season_points: 4210,
          user_id: MEMBER_ID,
        },
      ],
    },
  ];
}

function seasonHistoryMuscleLeaderboard(url: URL) {
  const scope = url.searchParams.get("scope");
  const muscleKey = url.searchParams.get("muscle_key");
  const seasonId = url.searchParams.get("season_id");
  if (scope !== "season" || !muscleKey || !seasonId) return [];

  const rows: Record<string, { displayName: string; seasonTitle: string; xpPoints: number }> = {
    [`${JOURNEY_SEASON_ONE_ID}:shoulders`]: {
      displayName: "Summer Shoulder Leader",
      seasonTitle: "Summer Foundations",
      xpPoints: 6120,
    },
    [`${JOURNEY_SEASON_ONE_ID}:back`]: {
      displayName: "Summer Back Leader",
      seasonTitle: "Summer Foundations",
      xpPoints: 5480,
    },
    [`${JOURNEY_SEASON_TWO_ID}:shoulders`]: {
      displayName: "Spring Shoulder Leader",
      seasonTitle: "Spring Strength",
      xpPoints: 7340,
    },
    [`${JOURNEY_SEASON_TWO_ID}:back`]: {
      displayName: "Spring Back Leader",
      seasonTitle: "Spring Strength",
      xpPoints: 6890,
    },
  };
  const row = rows[`${seasonId}:${muscleKey}`];
  if (!row) return [];

  return [
    {
      avatar_url: null,
      display_name: row.displayName,
      icon_asset_key: null,
      icon_key: "dumbbell",
      icon_kind: "library",
      is_current_user: true,
      last_earned_at: "2026-05-30T06:00:00.000Z",
      muscle_key: muscleKey,
      rank_position: 1,
      scope: "season",
      season_id: seasonId,
      season_title: row.seasonTitle,
      user_id: MEMBER_ID,
      xp_points: row.xpPoints,
    },
  ];
}

function integritySummary() {
  return {
    last_flagged_at: null,
    last_resolved_at: null,
    open_case_count: 0,
    recent_cases: [],
    risk_level: "low",
    user_id: MEMBER_ID,
  };
}

function progressionProfile() {
  return {
    active_season: activeSeason(),
    created_at: "2026-08-01T00:00:00.000Z",
    current_season_points: 2800,
    current_streak: 6,
    integrity_risk_level: "low",
    last_progressed_at: "2026-09-08T06:00:00.000Z",
    longest_streak: 14,
    ranking_governance_status: "normal",
    ranking_visibility: "public",
    total_xp: 14000,
    updated_at: "2026-09-08T06:00:00.000Z",
    user_id: MEMBER_ID,
  };
}

function seasonStanding() {
  return {
    is_disqualified: false,
    is_hidden: false,
    last_earned_at: "2026-09-08T06:00:00.000Z",
    rank_position: 4,
    season: activeSeason(),
    season_points: 2800,
    user_id: MEMBER_ID,
  };
}

async function installMasteryFixtures(
  page: Page,
  state: MasteryFixtureState,
  options: MasteryFixtureOptions = {},
) {
  const claimedMilestoneIds = new Set<string>();  const responseMilestones = () => {
    const records = milestones(options);
    if (options.adminLifecycle) {
      records.push(adminCreatedMilestone(state.adminLifecycleStage));
      records.push(hiddenEarnedMilestone());
    }
    return records.map((record) =>
      claimedMilestoneIds.has(record.milestone_definition_id)
        ? {
            ...record,
            claimed_at: "2026-09-08T08:00:00.000Z",
            status: "claimed" as const,
          }
        : record,
    );
  };
  page.on("console", (message) => {
    if (message.type() === "error") state.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => state.consoleErrors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes("/v1/")) {
      state.observedRequests.push(`${request.method()} ${url.pathname}${url.search}`);
    }
  });

  await page.addInitScript((fixedBaseMs) => {
    const nativeDateNow = Date.now.bind(Date);
    const nativeStartMs = nativeDateNow();
    window.localStorage.setItem("fittrack_access_token", "mastery-touch-access-token");
    window.localStorage.setItem("fittrack_refresh_token", "mastery-touch-refresh-token");
    Date.now = () => fixedBaseMs + (nativeDateNow() - nativeStartMs);
  }, FIXED_NOW);

  await page.route("**/v1/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;
    if (method !== "GET") {
      state.mutations.push({ body: request.postDataJSON() ?? {}, method, path });
    }

    if (method === "POST" && /^\/v1\/fitness\/milestones\/[^/]+\/claim$/.test(path)) {
      const milestoneDefinitionId = path.split("/").at(-2) ?? "";
      state.claimRequests += 1;
      if (options.claimMode === "pending") {
        await new Promise((resolve) => setTimeout(resolve, 450));
      }
      if (options.claimMode === "failureOnce" && state.claimRequests === 1) {
        await route.fulfill({
          body: JSON.stringify({ detail: "Fixture claim failed." }),
          contentType: "application/json",
          status: 409,
        });
        return;
      }
      claimedMilestoneIds.add(milestoneDefinitionId);
      if (options.adminLifecycle && milestoneDefinitionId === ADMIN_MILESTONE_ID) {
        state.adminLifecycleStage = "claimed";
      }
      const claimed = responseMilestones().find(
        (record) => record.milestone_definition_id === milestoneDefinitionId,
      );
      if (!claimed) {
        await route.fulfill({
          body: JSON.stringify({ detail: "Unknown fixture milestone." }),
          contentType: "application/json",
          status: 404,
        });
        return;
      }
      await fulfill(route, {
        ...claimed,
        claimed_at: "2026-09-08T08:00:00.000Z",
        status: "claimed",
      });
      return;
    }

    if (method === "GET" && path === "/v1/users/me") {
      await fulfill(route, memberProfile());
      return;
    }
    if (method === "GET" && path === "/v1/users/deletion-request") {
      await fulfill(route, { status: null });
      return;
    }
    if (method === "GET" && path === "/v1/notifications/unread-count") {
      await fulfill(route, { count: 0 });
      return;
    }
    if (method === "GET" && path === "/v1/notifications/my") {
      await fulfillPaginated(route, [], {
        page: Number(url.searchParams.get("page") ?? 1),
        limit: Number(url.searchParams.get("limit") ?? 10),
        total: 0,
        total_pages: 0,
      });
      return;
    }
    if (method === "GET" && path === "/v1/membership/my-subscription") {
      await fulfill(route, {
        id: "membership-mastery-touch-fixture",
        plan: { name: "Fitness Access" },
        status: "active",
      });
      return;
    }
    if (method === "GET" && path === "/v1/fitness/mastery") {
      await fulfill(route, masteryRecords());
      return;
    }
    if (method === "GET" && path === "/v1/fitness/member/muscle-definitions") {
      await fulfill(route, muscleDefinitions());
      return;
    }
    if (method === "GET" && path === "/v1/fitness/leaderboard") {
      await fulfillPaginated(route, leaderboard(), {
        page: Number(url.searchParams.get("page") ?? 1),
        limit: Number(url.searchParams.get("limit") ?? 8),
        total: leaderboard().length,
        total_pages: 1,
      });
      return;
    }
    if (method === "GET" && path === "/v1/fitness/progression-profile") {
      await fulfill(route, progressionProfile());
      return;
    }
    if (method === "GET" && path === "/v1/fitness/ranking-profile") {
      await fulfill(route, {
        display_alias: null,
        governance_status: "normal",
        updated_at: "2026-09-08T06:00:00.000Z",
        user_id: MEMBER_ID,
        visibility: "public",
      });
      return;
    }
    if (method === "GET" && path === "/v1/fitness/season-standing") {
      await fulfill(route, seasonStanding());
      return;
    }
    if (method === "GET" && path === "/v1/fitness/milestones") {
      await fulfill(
        route,
        responseMilestones(),
      );
      return;
    }
    if (method === "GET" && path === "/v1/fitness/integrity-summary") {
      await fulfill(route, integritySummary());
      return;
    }
    if (method === "GET" && path === "/v1/fitness/season-history") {
      await fulfill(route, seasonHistory(options.seasonHistoryJourney));
      return;
    }
    if (method === "GET" && path === "/v1/fitness/muscle-leaderboard") {
      if (options.seasonHistoryJourney) {
        const records = seasonHistoryMuscleLeaderboard(url);
        await fulfillPaginated(route, records, {
          page: Number(url.searchParams.get("page") ?? 1),
          limit: Number(url.searchParams.get("limit") ?? 8),
          total: records.length,
          total_pages: records.length > 0 ? 1 : 0,
        });
        return;
      }
      await fulfillPaginated(route, [], {
        page: Number(url.searchParams.get("page") ?? 1),
        limit: Number(url.searchParams.get("limit") ?? 8),
        total: 0,
        total_pages: 0,
      });
      return;
    }

    state.unhandled.push(`${method} ${path}${url.search}`);
    await route.abort("blockedbyclient");
  });
}

async function dismissAutomaticHelp(page: Page) {
  const helpTitle = page.getByText("Help - Muscle Mastery", { exact: true });
  try {
    await helpTitle.waitFor({ state: "visible", timeout: 5_000 });
  } catch {
    return;
  }
  const closeHelp = page.getByRole("button", { name: "Close help", exact: true });
  await expect(closeHelp).toBeVisible();
  await closeHelp.tap();
  await expect(helpTitle).toBeHidden();
}

async function enterMastery(page: Page, state: MasteryFixtureState) {
  await page.goto(`${MOBILE_BASE_URL}/mastery`, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/mastery(?:\?|$)/);
  await expect(page.getByText("Muscle Mastery", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("6 day streak", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("tab", { name: "Show Summary", exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("mastery-page-scroll")).toBeVisible({ timeout: 20_000 });
  await dismissAutomaticHelp(page);
  await stabilizeVisualPage(page);
  expect(state.unhandled, "mastery fixture requests before interaction").toEqual([]);
}

async function tapHeaderMenu(page: Page) {
  const helpButton = page.getByRole("button", { name: "Open page help", exact: true });
  await expect(helpButton, "header help control").toHaveCount(1);
  const header = helpButton.locator("xpath=../..");
  await expect(header, "header container from help control").toHaveCount(1);
  const directHeaderPressables = header.locator(
    ":scope > button, :scope > [role='button'], :scope > [tabindex='0']",
  );
  await expect(directHeaderPressables, "direct header pressables").toHaveCount(1);
  const menuButton = directHeaderPressables.first();
  const menuIcon = menuButton.locator(
    'svg:has(> path[d="M4 5h16"]):has(> path[d="M4 12h16"]):has(> path[d="M4 19h16"])',
  );
  await expect(menuIcon, "header hamburger icon").toHaveCount(1);
  const box = await menuButton.boundingBox();
  expect(box, "header hamburger bounds").not.toBeNull();
  if (!box) return;
  const viewport = page.viewportSize();
  expect(box.width).toBeGreaterThan(0);
  expect(box.height).toBeGreaterThan(0);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport?.width ?? 0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport?.height ?? 0);
  const hitTarget = await menuButton.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const point = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return Boolean(point && (point === element || element.contains(point)));
  });
  expect(hitTarget, "header hamburger hit target").toBe(true);
  await menuButton.tap();
}

async function openFab(page: Page) {
  const open = page.getByRole("button", { name: "Open quick actions menu", exact: true });
  await expect(open).toBeVisible();
  await open.tap();
  await expect(page.getByRole("button", { name: "Close quick actions menu", exact: true })).toBeVisible();
}

function fabWorkoutAction(page: Page) {
  return page.getByRole("button", { name: "Workout. Track EXP", exact: true });
}

async function readScrollMetrics(scroll: ReturnType<Page["getByTestId"]>): Promise<ScrollMetrics> {
  return scroll.evaluate((element) => {
    const nodes = [element, ...Array.from(element.querySelectorAll<HTMLElement>("*"))];
    const scrollables = nodes.filter((node) => node.scrollHeight > node.clientHeight + 4);
    const target = scrollables[0] ?? element;
    return {
      clientHeight: target.clientHeight,
      scrollHeight: target.scrollHeight,
      scrollTop: target.scrollTop,
      scrollableCount: scrollables.length,
    };
  });
}

async function swipeMasteryContent(page: Page, scroll: ReturnType<Page["getByTestId"]>, avoidFabMenu = false) {
  const box = await scroll.boundingBox();
  expect(box, "mastery scroll bounds").not.toBeNull();
  if (!box) return;
  const startX = box.x + 32;
  const startY = box.y + Math.min(300, Math.max(120, box.height - 80));
  const endY = Math.max(box.y + 24, startY - 360);
  if (avoidFabMenu) {
    const menuBoxes = await fabWorkoutAction(page).evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { bottom: rect.bottom, left: rect.left, right: rect.right, top: rect.top };
      }),
    );
    expect(
      menuBoxes.every(({ bottom, left, right, top }) => startX < left || startX > right || startY < top || startY > bottom),
      "open-FAB swipe starts outside the quick-action menu",
    ).toBe(true);
  }
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ id: 1, x: startX, y: startY }],
  });
  for (let step = 1; step <= 12; step += 1) {
    const progress = step / 12;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ id: 1, x: startX, y: startY + (endY - startY) * progress }],
    });
  }
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await client.detach();
}

async function readOverflowDiagnostics(page: Page) {
  return page.evaluate(() => {
    const viewport = { height: window.innerHeight, width: window.innerWidth };
    const dimensions = (element: HTMLElement | null) =>
      element
        ? {
            clientHeight: element.clientHeight,
            clientWidth: element.clientWidth,
            scrollHeight: element.scrollHeight,
            scrollWidth: element.scrollWidth,
          }
        : null;
    const outOfViewport = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return { element, rect, style };
      })
      .filter(({ element, rect, style }) => {
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
        if (rect.width <= 0 || rect.height <= 0) return false;
        return rect.left < -1 || rect.right > viewport.width + 1 || rect.top < -1 || rect.bottom > viewport.height + 1;
      })
      .slice(0, 24)
      .map(({ element, rect, style }) => ({
        bounds: {
          bottom: rect.bottom,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          width: rect.width,
        },
        tag: element.tagName.toLowerCase(),
        text: (element.innerText || element.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 100),
        style: {
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          pointerEvents: style.pointerEvents,
          position: style.position,
          transform: style.transform,
        },
      }));

    return {
      body: dimensions(document.body),
      document: dimensions(document.documentElement),
      outOfViewport,
      viewport,
    };
  });
}

async function waitForSettledBounds(locator: Locator) {
  await expect
    .poll(
      async () =>
        locator.evaluate(async (element) => {
          const readBounds = () => {
            const rect = element.getBoundingClientRect();
            return [rect.bottom, rect.height, rect.left, rect.right, rect.top, rect.width].map((value) => Math.round(value));
          };
          const first = readBounds();
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          const second = readBounds();
          return first.every((value, index) => value === second[index]);
        }),
      { intervals: [50, 100, 200], timeout: 3000 },
    )
    .toBe(true);
}

async function captureEvidence(
  page: Page,
  testInfo: TestInfo,
  state: MasteryFixtureState,
  name: string,
  scrollMetrics?: ScrollMetrics,
) {
  const audit = await auditConventionalLayout(page);
  const overflowDiagnostics = audit.horizontalOverflow ? await readOverflowDiagnostics(page) : undefined;
  const evidenceRoot = resolve(process.cwd(), ".artifacts", "playwright", "mastery-touch");
  await mkdir(evidenceRoot, { recursive: true });
  const safeName = `${testInfo.project.name}-${testInfo.testId}-${name}`.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const evidence = {
    audit,
    mutations: state.mutations,
    observedRequests: state.observedRequests,
    overflowDiagnostics,
    route: await page.url(),
    scrollMetrics,
    unhandled: state.unhandled,
  };
  await writeFile(resolve(evidenceRoot, `${safeName}.layout.json`), JSON.stringify(evidence, null, 2));
  await testInfo.attach(`${name}-layout.json`, {
    body: JSON.stringify(evidence, null, 2),
    contentType: "application/json",
  });
  await page.screenshot({ fullPage: true, path: resolve(evidenceRoot, `${safeName}.png`) });
  return audit;
}

async function captureMilestoneArtifact(
  page: Page,
  testInfo: TestInfo,
  name: string,
  details: Record<string, unknown>,
) {
  const evidenceRoot = resolve(process.cwd(), ".artifacts", "playwright", "milestone-celebration");
  await mkdir(evidenceRoot, { recursive: true });
  const safeName = `${testInfo.project.name}-${testInfo.testId}-${name}`.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const imagePath = resolve(evidenceRoot, `${safeName}.png`);
  const jsonPath = resolve(evidenceRoot, `${safeName}.json`);
  await page.evaluate(async () => {
    await document.fonts?.ready;
  });
  const claimedModal = page.getByTestId("milestone-claimed-modal");
  if (await claimedModal.count()) {
    await expect(claimedModal).toBeVisible();
    await waitForSettledBounds(claimedModal);
  }
  await page.screenshot({ fullPage: false, path: imagePath });
  await writeFile(
    jsonPath,
    JSON.stringify({ details, route: await page.url(), viewport: page.viewportSize() }, null, 2),
  );
  await testInfo.attach(`${name}.png`, { path: imagePath, contentType: "image/png" });
  await testInfo.attach(`${name}.json`, { path: jsonPath, contentType: "application/json" });
}

function assertCleanLayout(audit: VisualLayoutAudit) {
  expect(audit.horizontalOverflow, "horizontal overflow").toBe(false);
  expect(audit.clipping, "clipped text or controls").toEqual([]);
  expect(audit.overlaps, "overlapping interactive controls").toEqual([]);
  expect(audit.nestedScrollbars, "nested scrollbars").toEqual([]);
}

function assertFixtureClosed(state: MasteryFixtureState) {
  expect(state.unhandled, "unexpected API requests").toEqual([]);
  expect(state.mutations, "mastery touch journeys should not write to the API").toEqual([]);
  expect(state.consoleErrors, "unexpected mastery route console errors").toEqual([]);
}

function hasSeasonMuscleRequest(state: MasteryFixtureState, seasonId: string, muscleKey: string) {
  return state.observedRequests.some((request) => {
    if (!request.startsWith("GET /v1/fitness/muscle-leaderboard?")) return false;
    const params = new URLSearchParams(request.slice(request.indexOf("?") + 1));
    return params.get("scope") === "season" && params.get("muscle_key") === muscleKey && params.get("season_id") === seasonId;
  });
}

test.describe("mastery touch · shell controls", () => {
  test("header controls remain tappable with the FAB closed and open", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390x844");
    const state = newFixtureState();
    await installMasteryFixtures(page, state);
    await enterMastery(page, state);

    const helpTitle = page.getByText("Help - Muscle Mastery", { exact: true });
    await page.getByRole("button", { name: "Open page help", exact: true }).tap();
    await expect(helpTitle).toBeVisible();
    await expect(fabWorkoutAction(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Close help", exact: true }).tap();
    await expect(helpTitle).toBeHidden();

    await page.getByRole("button", { name: "Open notifications", exact: true }).tap();
    await expect(page.getByText("NOTIFICATION INBOX", { exact: true })).toBeVisible();
    await expect(page.getByText("All caught up", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).tap();
    await expect(page.getByText("NOTIFICATION INBOX", { exact: true })).toBeHidden();

    await tapHeaderMenu(page);
    await expect(page.getByRole("button", { name: "Home", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Muscle Mastery", exact: true }).tap();

    await openFab(page);
    await page.getByRole("button", { name: "Open page help", exact: true }).tap();
    await expect(helpTitle).toBeVisible();
    await expect(fabWorkoutAction(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Close help", exact: true }).tap();

    await openFab(page);
    await page.getByRole("button", { name: "Open notifications", exact: true }).tap();
    await expect(page.getByText("NOTIFICATION INBOX", { exact: true })).toBeVisible();
    await expect(fabWorkoutAction(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Close", exact: true }).tap();

    await openFab(page);
    await tapHeaderMenu(page);
    await expect(page.getByRole("button", { name: "Home", exact: true })).toBeVisible();
    await expect(fabWorkoutAction(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Muscle Mastery", exact: true }).tap();

    const audit = await captureEvidence(page, testInfo, state, "header-actions-390");
    assertCleanLayout(audit);
    assertFixtureClosed(state);
  });

  test("each Mastery tab closes an open FAB on its first tap", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390x844");
    const state = newFixtureState();
    await installMasteryFixtures(page, state);
    await enterMastery(page, state);

    const tabCases = [
      {
        label: "Milestones",
        current: page.getByPlaceholder("Search milestones"),
        previous: page.getByText("Overall progression", { exact: true }),
      },
      {
        label: "Muscle EXP",
        current: page.getByPlaceholder("Search muscle group"),
        previous: page.getByPlaceholder("Search milestones"),
      },
      {
        label: "Leaderboard",
        current: page.getByRole("button", { name: "Leaderboard: Overall", exact: true }),
        previous: page.getByPlaceholder("Search muscle group"),
      },
      {
        label: "Summary",
        current: page.getByText("Overall progression", { exact: true }),
        previous: page.getByRole("button", { name: "Leaderboard: Overall", exact: true }),
      },
    ];

    for (const { current, label, previous } of tabCases) {
      await openFab(page);
      const tab = page.getByRole("tab", { name: `Show ${label}`, exact: true });
      await tab.tap();
      await expect(fabWorkoutAction(page)).toHaveCount(0);
      await expect(current, `${label} panel proof`).toBeVisible();
      await expect(previous, `${label} previous panel content`).toHaveCount(0);

      const audit = await captureEvidence(page, testInfo, state, `tab-${label.toLowerCase().replaceAll(" ", "-")}-390`);
      assertCleanLayout(audit);
    }

    assertFixtureClosed(state);
  });
});

test.describe("mastery touch · scroll and lifecycle", () => {
  test("touch swipe scrolls with the FAB closed at both mobile widths", async ({ page }, testInfo) => {
    const state = newFixtureState();
    await installMasteryFixtures(page, state);
    await enterMastery(page, state);

    const scroll = page.getByTestId("mastery-page-scroll");
    const initialMetrics = await readScrollMetrics(scroll);
    expect(initialMetrics.scrollableCount, "one mastery scroll owner").toBe(1);
    expect(initialMetrics.scrollHeight, "summary content should be scrollable").toBeGreaterThan(initialMetrics.clientHeight + 4);

    await swipeMasteryContent(page, scroll);
    await expect.poll(async () => (await readScrollMetrics(scroll)).scrollTop).toBeGreaterThan(initialMetrics.scrollTop + 4);

    const scrollMetrics = await readScrollMetrics(scroll);
    expect(scrollMetrics.scrollTop).toBeGreaterThan(initialMetrics.scrollTop + 4);
    const audit = await captureEvidence(page, testInfo, state, `content-swipe-closed-${testInfo.project.name}`, scrollMetrics);
    assertCleanLayout(audit);
    assertFixtureClosed(state);
  });

  test("touch swipe with the open FAB closes it and scrolls at both mobile widths", async ({ page }, testInfo) => {
    const state = newFixtureState();
    await installMasteryFixtures(page, state);
    await enterMastery(page, state);

    const scroll = page.getByTestId("mastery-page-scroll");
    const initialMetrics = await readScrollMetrics(scroll);
    expect(initialMetrics.scrollableCount, "one mastery scroll owner").toBe(1);
    expect(initialMetrics.scrollHeight, "summary content should be scrollable").toBeGreaterThan(initialMetrics.clientHeight + 4);

    await openFab(page);
    await expect(fabWorkoutAction(page)).toBeVisible();
    await swipeMasteryContent(page, scroll, true);
    await expect(fabWorkoutAction(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Close quick actions menu", exact: true })).toHaveCount(0);
    await expect.poll(async () => (await readScrollMetrics(scroll)).scrollTop).toBeGreaterThan(initialMetrics.scrollTop + 4);

    const scrollMetrics = await readScrollMetrics(scroll);
    expect(scrollMetrics.scrollTop).toBeGreaterThan(initialMetrics.scrollTop + 4);
    const audit = await captureEvidence(page, testInfo, state, `content-swipe-open-${testInfo.project.name}`, scrollMetrics);
    assertCleanLayout(audit);
    assertFixtureClosed(state);
  });

  test("Season history opens from the FAB and closes cleanly", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390x844");
    const state = newFixtureState();
    await installMasteryFixtures(page, state);
    await enterMastery(page, state);

    await openFab(page);
    await page.getByRole("button", { name: "Season history. Review top performers", exact: true }).tap();
    const closeSeasonHistory = page.getByRole("button", { name: "Close season history", exact: true });
    const seasonHistoryHeader = closeSeasonHistory.locator("xpath=..");
    const seasonHistoryTitle = seasonHistoryHeader.getByText("Season history", { exact: true });
    const quickActionItems = page.getByRole("button", {
      includeHidden: true,
      name: /^(Workout\. Track EXP|Nutrition\. Fuel progress|BrodigyAI\. Ask about training|Season history\. Review top performers)$/,
    });
    await expect(closeSeasonHistory).toBeVisible();
    await expect(seasonHistoryHeader).toHaveCount(1);
    await expect(seasonHistoryTitle).toBeVisible();
    await expect(page.getByText("Jordan Athlete", { exact: true })).toBeVisible();
    await expect(quickActionItems, "quick-action items unmounted behind Season history").toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Close quick actions menu", exact: true, includeHidden: true }),
      "FAB close control unmounted behind Season history",
    ).toHaveCount(0);
    await waitForSettledBounds(seasonHistoryHeader);

    const openAudit = await captureEvidence(page, testInfo, state, "season-history-open-390");
    assertCleanLayout(openAudit);

    await closeSeasonHistory.tap();
    await expect(closeSeasonHistory).toHaveCount(0);
    await expect(seasonHistoryHeader).toHaveCount(0);
    await expect(seasonHistoryTitle).toHaveCount(0);
    await expect(page.getByText("Jordan Athlete", { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Close quick actions menu", exact: true, includeHidden: true }),
      "FAB remains closed after Season history",
    ).toHaveCount(0);
    await page.getByRole("tab", { name: "Show Milestones", exact: true }).tap();
    await expect(page.getByPlaceholder("Search milestones")).toBeVisible();

    const audit = await captureEvidence(page, testInfo, state, "season-history-closed-390");
    assertCleanLayout(audit);
    assertFixtureClosed(state);
  });

  test("Season history picker and muscle filter stay touchable in one modal", async ({ page }, testInfo) => {
    const state = newFixtureState();
    await installMasteryFixtures(page, state, { seasonHistoryJourney: true });
    await enterMastery(page, state);

    await openFab(page);
    await page.getByRole("button", { name: "Season history. Review top performers", exact: true }).tap();
    const closeSeasonHistory = page.getByRole("button", { name: "Close season history", exact: true });
    const closeSeasonPicker = page.getByRole("button", { name: "Close season picker", exact: true });
    const seasonHistoryHeader = closeSeasonHistory.locator("xpath=..");
    await expect(closeSeasonHistory).toBeVisible();

    const byMuscle = page.getByRole("button", { name: "By muscle", exact: true });
    await byMuscle.scrollIntoViewIfNeeded();
    await byMuscle.tap();
    const muscleFilter = page.getByRole("button", {
      name: "Filter season history muscles: Shoulders (2 active muscles)",
      exact: true,
    });
    await expect(muscleFilter).toBeVisible();
    await expect(page.getByText("Summer Shoulder Leader", { exact: true })).toBeVisible();
    await expect
      .poll(() => hasSeasonMuscleRequest(state, JOURNEY_SEASON_ONE_ID, "shoulders"))
      .toBe(true);

    const firstSeasonButton = page.getByRole("button", { name: "Summer Foundations", exact: true });
    await firstSeasonButton.scrollIntoViewIfNeeded();
    await firstSeasonButton.tap();
    await expect(page.getByText("Choose a season", { exact: true })).toBeVisible();
    await expect(closeSeasonPicker).toBeVisible();
    await expect(closeSeasonHistory).toHaveCount(0);
    await expect(byMuscle).toHaveCount(0);

    await closeSeasonPicker.tap();
    await expect(closeSeasonPicker).toHaveCount(0);
    await expect(closeSeasonHistory).toBeVisible();
    await expect(byMuscle).toBeVisible();
    await expect(page.getByText("Summer Shoulder Leader", { exact: true })).toBeVisible();

    await firstSeasonButton.tap();
    const seasonSearch = page.getByPlaceholder("Search seasons");
    await seasonSearch.fill("no matching season");
    await expect(page.getByText("No seasons match this search.", { exact: true })).toBeVisible();
    await seasonSearch.fill("");
    await expect(page.getByText("Summer Foundations", { exact: true })).toBeVisible();
    await expect(page.getByText("Spring Strength", { exact: true })).toBeVisible();
    await waitForSettledBounds(page.getByText("Choose a season", { exact: true }));
    const pickerAudit = await captureEvidence(page, testInfo, state, `season-history-picker-${testInfo.project.name}`);
    assertCleanLayout(pickerAudit);

    const secondSeason = page.getByText("Spring Strength", { exact: true });
    await secondSeason.scrollIntoViewIfNeeded();
    await secondSeason.tap();
    await expect(closeSeasonPicker).toHaveCount(0);
    await expect(page.getByText("Fixed top-10 · Spring Strength", { exact: true })).toBeVisible();
    await expect(page.getByText("Spring Shoulder Leader", { exact: true })).toBeVisible();
    await expect
      .poll(() => hasSeasonMuscleRequest(state, JOURNEY_SEASON_TWO_ID, "shoulders"))
      .toBe(true);

    await muscleFilter.scrollIntoViewIfNeeded();
    await muscleFilter.tap();
    const backOption = page.getByRole("button", { name: "Muscle: Back", exact: true });
    await expect(backOption).toBeVisible();
    await backOption.scrollIntoViewIfNeeded();
    const openFilterAudit = await captureEvidence(page, testInfo, state, `season-history-filter-open-${testInfo.project.name}`);
    assertCleanLayout(openFilterAudit);
    await backOption.tap();
    const selectedBackFilter = page.getByRole("button", {
      name: "Filter season history muscles: Back (2 active muscles)",
      exact: true,
    });
    await expect(selectedBackFilter).toBeVisible();
    await expect(page.getByText("Spring Back Leader", { exact: true })).toBeVisible();
    await expect
      .poll(() => hasSeasonMuscleRequest(state, JOURNEY_SEASON_TWO_ID, "back"))
      .toBe(true);
    await waitForSettledBounds(seasonHistoryHeader);
    const filterAudit = await captureEvidence(page, testInfo, state, `season-history-filter-${testInfo.project.name}`);
    assertCleanLayout(filterAudit);

    const overall = page.getByRole("button", { name: "Overall", exact: true });
    await overall.scrollIntoViewIfNeeded();
    await overall.tap();
    await expect(page.getByText("Spring Back Leader", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Taylor Trainer", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Spring Strength", exact: true })).toBeVisible();

    const springSeasonButton = page.getByRole("button", { name: "Spring Strength", exact: true });
    await springSeasonButton.scrollIntoViewIfNeeded();
    await springSeasonButton.tap();
    await expect(closeSeasonPicker).toBeVisible();
    await expect(closeSeasonHistory).toHaveCount(0);
    const firstSeasonRow = page.getByText("Summer Foundations", { exact: true });
    await firstSeasonRow.scrollIntoViewIfNeeded();
    await firstSeasonRow.tap();
    await expect(closeSeasonPicker).toHaveCount(0);
    await expect(page.getByText("Fixed top-10 · Summer Foundations", { exact: true })).toBeVisible();
    await expect(page.getByText("Jordan Athlete", { exact: true })).toBeVisible();

    await byMuscle.scrollIntoViewIfNeeded();
    await byMuscle.tap();
    await expect(page.getByText("Summer Back Leader", { exact: true })).toBeVisible();
    await firstSeasonButton.tap();
    await seasonSearch.fill("Spring");
    await expect(page.getByText("Spring Strength", { exact: true })).toBeVisible();
    await closeSeasonPicker.tap();
    await expect(closeSeasonPicker).toHaveCount(0);
    await expect(closeSeasonHistory).toBeVisible();

    await selectedBackFilter.tap();
    await expect(page.getByRole("button", { name: "Muscle: Shoulders", exact: true })).toBeVisible();
    await closeSeasonHistory.tap();
    await expect(closeSeasonHistory).toHaveCount(0);
    await expect(closeSeasonPicker).toHaveCount(0);

    await openFab(page);
    await page.getByRole("button", { name: "Season history. Review top performers", exact: true }).tap();
    await expect(closeSeasonHistory).toBeVisible();
    await expect(closeSeasonPicker).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Muscle: Shoulders", exact: true })).toBeHidden();
    const reopenedBackFilter = page.getByRole("button", {
      name: "Filter season history muscles: Back (2 active muscles)",
      exact: true,
    });
    await expect(reopenedBackFilter).toBeVisible();
    await expect(page.getByText("Summer Back Leader", { exact: true })).toBeVisible();

    await firstSeasonButton.tap();
    await expect(seasonSearch).toBeVisible();
    await expect(seasonSearch).toHaveValue("");
    await closeSeasonPicker.tap();
    await waitForSettledBounds(seasonHistoryHeader);
    const reopenedAudit = await captureEvidence(page, testInfo, state, `season-history-reopened-${testInfo.project.name}`);
    assertCleanLayout(reopenedAudit);
    assertFixtureClosed(state);
  });

  test("Settings navigation and return start Mastery with the FAB closed", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390x844");
    const state = newFixtureState();
    await installMasteryFixtures(page, state);
    await enterMastery(page, state);

    await openFab(page);
    await tapHeaderMenu(page);
    await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible();
    await expect(fabWorkoutAction(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Settings", exact: true }).tap();
    await expect(page).toHaveURL(/\/settings(?:\?|$)/);

    await tapHeaderMenu(page);
    await expect(page.getByRole("button", { name: "Muscle Mastery", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Muscle Mastery", exact: true }).tap();
    await expect(page).toHaveURL(/\/mastery(?:\?|$)/);
    await dismissAutomaticHelp(page);
    await expect(page.getByRole("button", { name: "Open quick actions menu", exact: true })).toBeVisible();
    await expect(fabWorkoutAction(page)).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Show Summary", exact: true })).toBeVisible();

    const audit = await captureEvidence(page, testInfo, state, "settings-return-390");
    assertCleanLayout(audit);
    assertFixtureClosed(state);
  });
});

test.describe("mastery touch · milestone celebration", () => {
  const longClaimTitle =
    "Build a weekly rhythm with consistent strength sessions and mindful recovery";

  async function enterMilestones(page: Page, state: MasteryFixtureState) {
    await enterMastery(page, state);
    if (page.viewportSize()?.width === 320) {
      await page.setViewportSize({ width: 320, height: 568 });
    }
    await page.getByRole("tab", { name: "Show Milestones", exact: true }).tap();
    await expect(page.getByPlaceholder("Search milestones")).toBeVisible();
    await expect(page.getByTestId("milestone-grid")).toBeVisible();
  }

  test("successful claims celebrate once, keep long titles wrapped, and preserve milestone journeys", async ({ page }, testInfo) => {
    const state = newFixtureState();
    await installMasteryFixtures(page, state, {
      additionalClaimable: true,
      longClaimTitle,
    });
    await enterMilestones(page, state);

    const grid = page.getByTestId("milestone-grid");
    const firstCard = page.getByTestId("milestone-card-mastery-touch-milestone-2");
    await firstCard.scrollIntoViewIfNeeded();
    const [gridBox, cardBox] = await Promise.all([grid.boundingBox(), firstCard.boundingBox()]);
    expect(gridBox, "milestone grid bounds").not.toBeNull();
    expect(cardBox, "claimable milestone card bounds").not.toBeNull();
    await captureMilestoneArtifact(page, testInfo, "widened-milestone-grid", {
      cardWidth: cardBox?.width ?? null,
      gridWidth: gridBox?.width ?? null,
    });

    const search = page.getByPlaceholder("Search milestones");
    await search.fill("weekly");
    await expect(firstCard).toBeVisible();
    await expect(page.getByTestId("milestone-card-mastery-touch-milestone-3")).toHaveCount(0);
    await search.fill("");

    const detailsTrigger = page.getByTestId("milestone-details-trigger-mastery-touch-milestone-2");
    await detailsTrigger.tap();
    await expect(page.getByTestId("milestone-details-modal")).toBeVisible();
    await page.getByRole("button", { name: "Close milestone details", exact: true }).tap();
    await expect(page.getByTestId("milestone-details-modal")).toHaveCount(0);

    await expect(page.getByRole("button", { name: "Load more milestones", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Load more milestones", exact: true }).tap();
    await expect(page.getByTestId("milestone-card-mastery-touch-milestone-8")).toBeVisible();

    const claimFirst = page.getByTestId("milestone-claim-mastery-touch-milestone-2");
    await claimFirst.scrollIntoViewIfNeeded();
    await claimFirst.tap();
    const claimedModal = page.getByTestId("milestone-claimed-modal");
    await expect(claimedModal).toBeVisible({ timeout: 10_000 });
    await expect(claimedModal.getByText("Milestone achieved!", { exact: true })).toBeVisible();
    await expect(claimedModal.getByText(longClaimTitle, { exact: true })).toBeVisible();
    await expect(page.getByText(`${longClaimTitle} claimed.`, { exact: true })).toHaveCount(0);
    await captureMilestoneArtifact(page, testInfo, "claimed-modal", {
      title: longClaimTitle,
      width: page.viewportSize()?.width ?? null,
    });
    await claimedModal.getByRole("button", { name: "Let’s go!", exact: true }).tap();
    await expect(claimedModal).toHaveCount(0);

    const claimSecond = page.getByTestId("milestone-claim-mastery-touch-milestone-8");
    await claimSecond.scrollIntoViewIfNeeded();
    await claimSecond.tap();
    await expect(claimedModal).toBeVisible({ timeout: 10_000 });
    await claimedModal.getByRole("button", { name: "Let’s go!", exact: true }).tap();
    await expect(claimedModal).toHaveCount(0);

    expect(state.claimRequests).toBe(2);
    expect(state.mutations.map(({ method, path }) => `${method} ${path}`)).toEqual([
      "POST /v1/fitness/milestones/mastery-touch-milestone-2/claim",
      "POST /v1/fitness/milestones/mastery-touch-milestone-8/claim",
    ]);
    expect(state.unhandled).toEqual([]);
    expect(state.consoleErrors).toEqual([]);
  });

  test("pending claims ignore double taps and do not celebrate before the response", async ({ page }) => {
    const state = newFixtureState();
    await installMasteryFixtures(page, state, { claimMode: "pending" });
    await enterMilestones(page, state);

    const claim = page.getByTestId("milestone-claim-mastery-touch-milestone-2");
    await claim.scrollIntoViewIfNeeded();
    const firstTap = claim.tap();
    await expect.poll(() => state.claimRequests).toBe(1);
    await expect(page.getByTestId("milestone-claimed-modal")).toHaveCount(0);
    const claimBox = await claim.boundingBox();
    expect(claimBox, "pending claim remains positioned for the duplicate touch").not.toBeNull();
    if (claimBox) {
      await page.mouse.click(claimBox.x + claimBox.width / 2, claimBox.y + claimBox.height / 2);
    }
    await firstTap;
    await expect(page.getByTestId("milestone-claimed-modal")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Let’s go!", exact: true }).tap();
    expect(state.claimRequests).toBe(1);
    expect(state.mutations).toHaveLength(1);
    expect(state.unhandled).toEqual([]);
    expect(state.consoleErrors).toEqual([]);
  });

  test("failed claims show an error without celebration and retry successfully", async ({ page }) => {
    const state = newFixtureState();
    await installMasteryFixtures(page, state, { claimMode: "failureOnce" });
    await enterMilestones(page, state);

    const claim = page.getByTestId("milestone-claim-mastery-touch-milestone-2");
    await claim.scrollIntoViewIfNeeded();
    await claim.tap();
    await expect(page.getByTestId("milestone-claimed-modal")).toHaveCount(0);
    await expect(page.getByText("Fixture claim failed.", { exact: true })).toBeVisible({ timeout: 10_000 });
    expect(state.claimRequests).toBe(1);

    await claim.tap();
    await expect(page.getByTestId("milestone-claimed-modal")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Let’s go!", exact: true }).tap();
    await expect(page.getByTestId("milestone-claimed-modal")).toHaveCount(0);
    expect(state.claimRequests).toBe(2);
    expect(state.unhandled).toEqual([]);
    expect(state.consoleErrors.length).toBeGreaterThan(0);
    expect(
      state.consoleErrors.every((error) =>
        error.includes("Failed to load resource: the server responded with a status of 409 (Conflict)"),
      ),
      "the only browser error should be the intentionally rejected fixture claim",
    ).toBe(true);
  });
  test("admin-created milestone evaluates, unlocks, claims, and preserves seeded rewards", async ({ page }, testInfo) => {
    const state = newFixtureState();
    await installMasteryFixtures(page, state, { adminLifecycle: true });
    await enterMilestones(page, state);

    const adminCard = page.getByTestId(`milestone-card-${ADMIN_MILESTONE_ID}`);
    await expect(adminCard).toBeVisible();
    await expect(adminCard.getByText("4 / 5", { exact: true })).toBeVisible();
    await expect(adminCard.getByRole("button", { name: "Locked", exact: true })).toBeVisible();
    await expect(page.getByText(HIDDEN_EARNED_MILESTONE_TITLE, { exact: true })).toBeVisible();
    await captureMilestoneArtifact(page, testInfo, "admin-created-before-unlock", {
      title: ADMIN_MILESTONE_TITLE,
      reward: "350 EXP",
      hiddenEarnedVisible: true,
    });

    // A new focused return refetches the stale-time-zero milestone query.
    state.adminLifecycleStage = "unlocked";
    await enterMilestones(page, state);
    await expect(adminCard.getByText("5 / 5", { exact: true })).toBeVisible();
    const claim = adminCard.getByTestId(`milestone-claim-${ADMIN_MILESTONE_ID}`);
    await expect(claim).toHaveAccessibleName(`Claim ${ADMIN_MILESTONE_TITLE}`);
    await claim.scrollIntoViewIfNeeded();
    await claim.tap();
    const claimedModal = page.getByTestId("milestone-claimed-modal");
    await expect(claimedModal).toBeVisible({ timeout: 10_000 });
    await expect(claimedModal.getByText(ADMIN_MILESTONE_TITLE, { exact: true })).toBeVisible();
    await captureMilestoneArtifact(page, testInfo, "admin-created-claimed", {
      title: ADMIN_MILESTONE_TITLE,
      reward: "350 EXP",
    });
    await claimedModal.getByRole("button", { name: "Let’s go!", exact: true }).tap();
    await expect(adminCard.getByRole("button", { name: "Claimed", exact: true })).toBeVisible();

    expect(state.claimRequests).toBe(1);
    expect(state.mutations.filter(({ path }) => path.includes("/claim"))).toHaveLength(1);
    expect(state.unhandled).toEqual([]);
    expect(state.consoleErrors).toEqual([]);
  });
});
