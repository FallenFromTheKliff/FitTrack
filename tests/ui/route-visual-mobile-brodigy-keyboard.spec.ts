import { expect, test, type Locator, type Page, type Route, type TestInfo } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  auditConventionalLayout,
  stabilizeVisualPage,
  type VisualLayoutAudit,
} from "./visual-stabilizer";

const MOBILE_BASE_URL =
  process.env.PLAYWRIGHT_MOBILE_BASE_URL ?? "http://127.0.0.1:8081";
const ACCESS_TOKEN = "brodigy-keyboard-fixture-access-token";
const REFRESH_TOKEN = "brodigy-keyboard-fixture-refresh-token";
const MEMBER_ID = "66666666-6666-4666-8666-666666666666";
const SESSION_ID = "77777777-7777-4777-8777-777777777777";
const TIMESTAMP = "2026-09-08T00:00:00.000Z";
const DRAFT_FIRST_LINE = "Keep this draft visible while the keyboard changes height.";
const DRAFT_SECOND_LINE = "The second line stays available for sending.";
const DRAFT = `${DRAFT_FIRST_LINE}\n${DRAFT_SECOND_LINE}`;
const OVERFLOW_DRAFT = Array.from(
  { length: 12 },
  (_, index) => `Composer line ${index + 1}`,
).join("\n");
const REPLY = "Keyboard fixture reply received.";

type RecordBody = Record<string, unknown>;

type Rect = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type ElementSample = {
  box: Rect | null;
  disabled: boolean;
  fontSize: number;
  opacity: number;
};

type FixtureState = {
  chatRequestSeen: boolean;
  consoleErrors: string[];
  observedRequests: string[];
  postedBody: RecordBody | null;
  releaseChat?: () => void;
  replyDelivered: boolean;
  requestFailures: string[];
  unhandled: string[];
};

function memberProfile() {
  return {
    email: "brodigy-keyboard-member@fittrack.test",
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
      first_name: "Keyboard",
      gender: "female",
      height_cm: 165,
      last_name: "Fixture",
      fitness_goal: "maintenance",
      weight_kg: 60,
    },
    role: "USER",
    status: "active",
  };
}

const sessionRecord = {
  context_type: "general",
  created_at: TIMESTAMP,
  id: SESSION_ID,
  is_active: true,
  last_activity_at: TIMESTAMP,
  title: "Keyboard geometry proof",
  updated_at: TIMESTAMP,
  user_id: MEMBER_ID,
};

const initialMessages = Array.from({ length: 16 }, (_, index) => ({
  action_triggered: null,
  content:
    index % 2 === 0
      ? "Member history " +
        (index + 1) +
        ": I want to keep this conversation available while composing a reply."
      : "Assistant history " +
        (index + 1) +
        ": Keep the movement controlled and leave room for recovery.",
  created_at: TIMESTAMP,
  id:
    "88888888-8888-4888-8888-" +
    String(index + 1).padStart(12, "0"),
  role: index % 2 === 0 ? "user" : "assistant",
  session_id: SESSION_ID,
  updated_at: TIMESTAMP,
}));

function paginated<T>(data: T[], limit: number) {
  return {
    data,
    meta: {
      limit,
      page: 1,
      total: data.length,
      total_pages: data.length ? 1 : 0,
    },
  };
}

async function fulfill(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    body: JSON.stringify({ data }),
    contentType: "application/json",
    status,
  });
}

async function installFixture(page: Page): Promise<FixtureState> {
  let releaseChat!: () => void;
  const chatGate = new Promise<void>((resolveGate) => {
    releaseChat = resolveGate;
  });
  const state: FixtureState = {
    chatRequestSeen: false,
    consoleErrors: [],
    observedRequests: [],
    postedBody: null,
    replyDelivered: false,
    requestFailures: [],
    unhandled: [],
  };

  page.on("console", (message) => {
    if (message.type() === "error") state.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => state.consoleErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/v1/")) {
      state.requestFailures.push(
        request.method() +
          " " +
          url.pathname +
          url.search +
          ": " +
          (request.failure()?.errorText ?? "unknown"),
      );
    }
  });

  await page.addInitScript(
    ({ accessToken, refreshToken, helpKey }) => {
      window.localStorage.setItem("fittrack_access_token", accessToken);
      window.localStorage.setItem("fittrack_refresh_token", refreshToken);
      window.localStorage.setItem(helpKey, "1");
    },
    {
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
      helpKey: "fittrack:auto-help-dismissed:" + MEMBER_ID + ":all",
    },
  );

  await page.route("**/v1/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;
    state.observedRequests.push(method + " " + path + url.search);

    if (method === "OPTIONS") {
      await route.fulfill({
        headers: {
          "access-control-allow-headers": "Authorization, Content-Type",
          "access-control-allow-methods": "GET, OPTIONS, POST",
          "access-control-allow-origin": request.headers().origin ?? "*",
        },
        status: 204,
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
      await route.fulfill({
        body: JSON.stringify(paginated([], 50)),
        contentType: "application/json",
        status: 200,
      });
      return;
    }
    if (method === "GET" && path === "/v1/ai/chat/sessions") {
      await route.fulfill({
        body: JSON.stringify(paginated([sessionRecord], 50)),
        contentType: "application/json",
        status: 200,
      });
      return;
    }
    if (
      method === "GET" &&
      /^\/v1\/ai\/chat\/sessions\/[^/]+\/messages$/.test(path)
    ) {
      const messages = state.replyDelivered
        ? [
            ...initialMessages,
            {
              action_triggered: null,
              content: REPLY,
              created_at: TIMESTAMP,
              id: "99999999-9999-4999-8999-999999999999",
              role: "assistant",
              session_id: SESSION_ID,
              updated_at: TIMESTAMP,
            },
          ]
        : initialMessages;
      await route.fulfill({
        body: JSON.stringify(paginated(messages, 100)),
        contentType: "application/json",
        status: 200,
      });
      return;
    }
    if (
      method === "GET" &&
      /^\/v1\/ai\/chat\/sessions\/[^/]+$/.test(path)
    ) {
      await fulfill(route, sessionRecord);
      return;
    }
    if (
      method === "POST" &&
      (path === "/v1/ai/chat" || path === "/v1/ai/chat/")
    ) {
      state.chatRequestSeen = true;
      state.postedBody = (request.postDataJSON() as RecordBody | null) ?? null;
      await chatGate;
      state.replyDelivered = true;
      await fulfill(
        route,
        {
          action_result: null,
          action_triggered: null,
          reply: REPLY,
          session_id: SESSION_ID,
        },
        201,
      );
      return;
    }

    state.unhandled.push(method + " " + path + url.search);
    await route.abort("blockedbyclient");
  });

  state.releaseChat = releaseChat;
  return state;
}

function roundedRect(
  box: { height: number; width: number; x: number; y: number } | null,
): Rect | null {
  if (!box) return null;
  return {
    height: Math.round(box.height),
    width: Math.round(box.width),
    x: Math.round(box.x),
    y: Math.round(box.y),
  };
}

async function sample(locator: Locator): Promise<ElementSample> {
  const [box, details] = await Promise.all([
    locator.boundingBox(),
    locator.evaluate((element) => {
      const style = window.getComputedStyle(element);
      let opacity = 1;
      let node: HTMLElement | null = element as HTMLElement;
      while (node && node !== document.body) {
        const value = Number.parseFloat(window.getComputedStyle(node).opacity);
        if (Number.isFinite(value)) opacity *= value;
        node = node.parentElement;
      }
      return {
        disabled:
          element instanceof HTMLButtonElement ||
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement
            ? element.disabled
            : element.getAttribute("aria-disabled") === "true",
        fontSize: Number.parseFloat(style.fontSize),
        opacity,
      };
    }),
  ]);
  return {
    box: roundedRect(box),
    disabled: details.disabled,
    fontSize: Number.isFinite(details.fontSize) ? details.fontSize : 0,
    opacity: Number.isFinite(details.opacity) ? details.opacity : 0,
  };
}

async function assertBoundedHitTarget(
  page: Page,
  target: Locator,
  label: string,
) {
  await expect
    .poll(
      async () => {
        const box = await target.boundingBox();
        const viewport = page.viewportSize();
        if (!box || !viewport || box.width <= 0 || box.height <= 0) return false;
        if (
          box.x < 0 ||
          box.y < 0 ||
          box.x + box.width > viewport.width ||
          box.y + box.height > viewport.height
        ) {
          return false;
        }
        return target.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const topmost = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          );
          return Boolean(
            topmost && (topmost === element || element.contains(topmost)),
          );
        });
      },
      {
        intervals: [50, 100, 250, 500],
        message: label + " should remain bounded and hittable",
        timeout: 8_000,
      },
    )
    .toBe(true);

  const details = await sample(target);
  expect(details.box, label + " bounds").not.toBeNull();
  expect(details.fontSize, label + " font size").toBeGreaterThanOrEqual(12);
  expect(details.opacity, label + " opacity").toBeGreaterThan(0.98);
}

async function waitForStableSample(locator: Locator, label: string) {
  let previous: ElementSample | null = null;
  await expect
    .poll(
      async () => {
        const current = await sample(locator);
        const stable =
          previous !== null &&
          JSON.stringify(previous.box) === JSON.stringify(current.box);
        previous = current;
        return Boolean(
          stable &&
            current.box &&
            current.opacity > 0.98 &&
            current.box.width > 0 &&
            current.box.height > 0,
        );
      },
      {
        intervals: [50, 100, 250, 500],
        message: label + " geometry and effective opacity should settle",
        timeout: 8_000,
      },
    )
    .toBe(true);
}

async function markHistoryScrollOwner(page: Page) {
  const message = page.getByText(
    "Member history 1: I want to keep this conversation available while composing a reply.",
    { exact: true },
  );
  await expect(message).toBeVisible();
  const found = await message.evaluate((element) => {
    let node: HTMLElement | null = element as HTMLElement;
    while (node && node !== document.body) {
      const style = window.getComputedStyle(node);
      if (["auto", "scroll", "overlay"].includes(style.overflowY)) {
        node.setAttribute("data-test-brodigy-history-scroll", "true");
        return true;
      }
      node = node.parentElement;
    }
    return false;
  });
  expect(found, "BrodigyAI history should expose a scroll owner").toBe(true);
  return page.locator('[data-test-brodigy-history-scroll="true"]').first();
}

async function historyMetrics(history: Locator) {
  return history.evaluate((element) => {
    const node = element as HTMLElement;
    return {
      clientHeight: Math.round(node.clientHeight),
      scrollHeight: Math.round(node.scrollHeight),
      scrollTop: Math.round(node.scrollTop),
    };
  });
}

function assertCleanLayout(audit: VisualLayoutAudit) {
  expect(audit.horizontalOverflow, "horizontal overflow").toBe(false);
  expect(audit.squishedText, "squished text").toEqual([]);
  expect(audit.clipping, "clipped text or controls").toEqual([]);
  expect(audit.overlaps, "overlapping interactive controls").toEqual([]);
  expect(audit.nestedScrollbars, "nested scrollbars").toEqual([]);
}

async function captureEvidence(
  page: Page,
  testInfo: TestInfo,
  state: FixtureState,
  label: string,
  input: Locator,
  send: Locator,
  history: Locator,
) {
  await waitForStableSample(input, label + " input");
  await waitForStableSample(send, label + " send");
  const audit = await auditConventionalLayout(page);
  const [inputSample, sendSample, historyState] = await Promise.all([
    sample(input),
    sample(send),
    historyMetrics(history),
  ]);
  const evidence = {
    audit,
    composer: { input: inputSample, send: sendSample },
    history: historyState,
    observedRequests: state.observedRequests,
    route: await page.url(),
    viewport: page.viewportSize(),
  };
  const evidenceRoot = resolve(
    process.cwd(),
    ".artifacts",
    "playwright",
    "brodigy-keyboard",
  );
  await mkdir(evidenceRoot, { recursive: true });
  const safeName = (
    String(testInfo.project.name) +
    "-" +
    testInfo.testId +
    "-" +
    label
  ).replace(/[^a-zA-Z0-9._-]+/g, "_");
  const body = JSON.stringify(evidence, null, 2);
  await writeFile(resolve(evidenceRoot, safeName + ".layout.json"), body);
  await testInfo.attach(label + ".layout.json", {
    body,
    contentType: "application/json",
  });
  const screenshotPath = resolve(evidenceRoot, safeName + ".png");
  await page.screenshot({ fullPage: true, path: screenshotPath });
  await testInfo.attach(label + ".png", {
    contentType: "image/png",
    path: screenshotPath,
  });
  return audit;
}

function assertFixtureClosed(state: FixtureState) {
  expect(state.unhandled, "unexpected API requests").toEqual([]);
  expect(state.requestFailures, "failed API requests").toEqual([]);
  expect(state.consoleErrors, "unexpected console or page errors").toEqual([]);
}

async function openChat(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  const state = await installFixture(page);
  await page.goto(
    MOBILE_BASE_URL +
      "/chatbot?sessionId=" +
      SESSION_ID +
      "&from=chathistory",
    { waitUntil: "domcontentloaded" },
  );
  await expect(page).toHaveURL(/\/chatbot\?[^#]*sessionId=/);
  await expect(
    page.getByText("Keyboard geometry proof", { exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByLabel("Type a message", { exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  await stabilizeVisualPage(page);
  return state;
}

test.describe("mobile BrodigyAI keyboard composer geometry", () => {
  test.describe.configure({ mode: "serial" });

  for (const scenario of [
    { fullHeight: 568, reducedHeight: 320, width: 320 },
    { fullHeight: 844, reducedHeight: 460, width: 390 },
  ] as const) {
    test(
      "keeps the composer reachable while the viewport shrinks at " +
        scenario.width +
        "px",
      async ({ page }, testInfo) => {
        test.skip(
          testInfo.project.name !==
            "mobile-" + scenario.width + "x" + scenario.fullHeight,
          "This journey runs in its matching mobile project.",
        );
        test.setTimeout(90_000);
        testInfo.annotations.push({
          type: "odiff",
          description:
            "N/A: browser viewport resize behavior proof; no native keyboard simulation or approved screenshot baseline.",
        });

        const state = await openChat(
          page,
          scenario.width,
          scenario.fullHeight,
        );
        const input = page.getByLabel("Type a message", { exact: true });
        const send = page.getByRole("button", {
          name: "Send message",
          exact: true,
        });
        const indicator = page.getByTestId("brodigyai-thinking-indicator");
        await expect(send).toBeVisible();
        await expect(input).toBeEditable();
        await waitForStableSample(input, "empty composer");
        const emptyComposerHeight = (await sample(input)).box?.height ?? 0;
        expect(
          await input.evaluate((element) => element.tagName),
          "BrodigyAI composer should be a multiline textarea",
        ).toBe("TEXTAREA");
        expect(emptyComposerHeight, "empty composer should have two-line room").toBeGreaterThanOrEqual(50);

        const history = await markHistoryScrollOwner(page);
        const initialHistory = await historyMetrics(history);
        expect(
          initialHistory.scrollHeight,
          "long chat should overflow its history owner",
        ).toBeGreaterThan(initialHistory.clientHeight);

        await input.fill(DRAFT_FIRST_LINE);
        await input.press("End");
        await input.press("Enter");
        await input.type(DRAFT_SECOND_LINE);
        await expect(input).toHaveValue(DRAFT);
        const twoLineComposerHeight = (await sample(input)).box?.height ?? 0;
        expect(twoLineComposerHeight).toBeGreaterThanOrEqual(emptyComposerHeight);

        await input.fill(OVERFLOW_DRAFT);
        await expect(input).toHaveValue(OVERFLOW_DRAFT);
        await expect
          .poll(async () => (await sample(input)).box?.height ?? 0)
          .toBeGreaterThan(twoLineComposerHeight);
        const cappedComposer = await sample(input);
        expect(cappedComposer.box?.height ?? 0, "composer should stop at its local cap").toBeLessThanOrEqual(140);
        const overflowMetrics = await input.evaluate((element) => ({
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
        }));
        expect(overflowMetrics.scrollHeight, "capped composer should scroll internally").toBeGreaterThan(
          overflowMetrics.clientHeight,
        );
        await assertBoundedHitTarget(page, input, "capped multiline input");
        await assertBoundedHitTarget(page, send, "send button beside capped input");

        await input.fill(DRAFT);
        await expect(input).toHaveValue(DRAFT);
        await assertBoundedHitTarget(page, input, "typing input at full height");
        await assertBoundedHitTarget(page, send, "send button at full height");

        await page.setViewportSize({
          width: scenario.width,
          height: scenario.reducedHeight,
        });
        await expect
          .poll(() => page.evaluate(() => window.innerHeight))
          .toBe(scenario.reducedHeight);
        await expect(input).toHaveValue(DRAFT);
        await assertBoundedHitTarget(
          page,
          input,
          "typing input at reduced height",
        );
        await assertBoundedHitTarget(
          page,
          send,
          "send button at reduced height",
        );
        const reducedAudit = await captureEvidence(
          page,
          testInfo,
          state,
          "typing-reduced",
          input,
          send,
          history,
        );
        assertCleanLayout(reducedAudit);

        const composerBeforeScroll = await sample(input);
        await history.evaluate((element) => {
          const node = element as HTMLElement;
          node.scrollTop = 0;
        });
        await expect.poll(async () => (await historyMetrics(history)).scrollTop).toBe(0);
        await history.evaluate((element) => {
          const node = element as HTMLElement;
          node.scrollTop = Math.min(
            node.scrollHeight - node.clientHeight,
            Math.max(1, Math.floor(node.clientHeight / 2)),
          );
        });
        await expect.poll(async () => (await historyMetrics(history)).scrollTop).toBeGreaterThan(0);
        const composerAfterScroll = await sample(input);
        expect(
          Math.abs(
            (composerAfterScroll.box?.y ?? 0) -
              (composerBeforeScroll.box?.y ?? 0),
          ),
          "history scrolling should not move the composer",
        ).toBeLessThanOrEqual(1);
        await assertBoundedHitTarget(
          page,
          input,
          "typing input after history scroll",
        );
        await assertBoundedHitTarget(
          page,
          send,
          "send button after history scroll",
        );

        await page.setViewportSize({
          width: scenario.width,
          height: scenario.fullHeight,
        });
        await expect
          .poll(() => page.evaluate(() => window.innerHeight))
          .toBe(scenario.fullHeight);
        await expect(input).toHaveValue(DRAFT);
        await assertBoundedHitTarget(page, input, "typing input after restore");
        await assertBoundedHitTarget(page, send, "send button after restore");
        const restoredAudit = await captureEvidence(
          page,
          testInfo,
          state,
          "typing-restored",
          input,
          send,
          history,
        );
        assertCleanLayout(restoredAudit);

        await send.click();
        await expect.poll(() => state.chatRequestSeen).toBe(true);
        expect(state.postedBody).toEqual({
          context_type: "general",
          message: DRAFT,
          session_id: SESSION_ID,
        });
        await expect(indicator).toBeVisible();
        await expect(indicator).toHaveAttribute("aria-busy", "true");
        await expect(input).not.toBeEditable();
        await expect(send).toBeDisabled();

        state.releaseChat?.();
        await expect(indicator).toBeHidden({ timeout: 15_000 });
        await expect(page.getByText(REPLY, { exact: true })).toBeVisible();
        await expect(input).toBeEditable();
        await expect(input).toHaveValue("");
        await expect
          .poll(async () => (await sample(input)).box?.height ?? 0)
          .toBeLessThanOrEqual(emptyComposerHeight + 1);
        await expect(send).toBeDisabled();
        assertFixtureClosed(state);
      },
    );
  }
});
