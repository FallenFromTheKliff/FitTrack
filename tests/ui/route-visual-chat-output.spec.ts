import { expect, test, type Page, type Route, type TestInfo } from "@playwright/test";

import { auditConventionalLayout, stabilizeVisualPage } from "./visual-stabilizer";

const MEMBER_ID = "66666666-6666-4666-8666-666666666666";
const SESSION_ID = "77777777-7777-4777-8777-777777777777";
const TIMESTAMP = "2026-09-08T00:00:00.000Z";
const SESSION_TITLE = "Chat output fixture";
const HISTORY_USER = "Member text: keep literal \\n and 日本語.";
const INVALID_HISTORY = "User Safety: safe";
const FALLBACK = "I couldn't format that response cleanly. Please try again.";
const USER_TEXT = "hey keep \\n literal — 日本語";
const VALID_REPLY = "For your safety, stop if pain increases.";

type FixtureMode = "history" | "loading" | "reject-then-valid";

type ChatBody = {
  context_type?: string;
  message?: string;
  session_id?: string;
  start_new_session?: boolean;
};

type FixtureState = {
  apiRequests: string[];
  chatBodies: ChatBody[];
  consoleErrors: string[];
  pageErrors: string[];
  providerRequests: string[];
  replyDelivered: boolean;
  releaseLoading: (() => void) | null;
};

const sessionRecord = {
  context_type: "general",
  created_at: TIMESTAMP,
  id: SESSION_ID,
  is_active: true,
  last_activity_at: TIMESTAMP,
  title: SESSION_TITLE,
  updated_at: TIMESTAMP,
  user_id: MEMBER_ID,
};

function memberProfile() {
  return {
    email: "chat-output-member@fittrack.test",
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
      first_name: "Chat",
      gender: "female",
      height_cm: 165,
      last_name: "Output",
      fitness_goal: "maintenance",
      weight_kg: 60,
    },
    role: "USER",
    status: "active",
  };
}

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

function historyMessages() {
  return [
    {
      action_triggered: null,
      content: HISTORY_USER,
      created_at: TIMESTAMP,
      id: "88888888-8888-4888-8888-888888888881",
      role: "user",
      session_id: SESSION_ID,
      updated_at: TIMESTAMP,
    },
    {
      action_triggered: null,
      content: INVALID_HISTORY,
      created_at: TIMESTAMP,
      id: "88888888-8888-4888-8888-888888888882",
      role: "assistant",
      session_id: SESSION_ID,
      updated_at: TIMESTAMP,
    },
    {
      action_triggered: null,
      content: "A clean saved assistant reply remains readable.",
      created_at: TIMESTAMP,
      id: "88888888-8888-4888-8888-888888888883",
      role: "assistant",
      session_id: SESSION_ID,
      updated_at: TIMESTAMP,
    },
  ];
}

function responseMessages(state: FixtureState) {
  return state.replyDelivered
    ? [
        ...historyMessages(),
        {
          action_triggered: null,
          content: VALID_REPLY,
          created_at: TIMESTAMP,
          id: "88888888-8888-4888-8888-888888888884",
          role: "assistant",
          session_id: SESSION_ID,
          updated_at: TIMESTAMP,
        },
      ]
    : historyMessages();
}

async function fulfill(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    body: JSON.stringify({ data }),
    contentType: "application/json",
    status,
  });
}

async function installFixture(page: Page, mode: FixtureMode) {
  let releaseLoading!: () => void;
  const loadingGate = new Promise<void>((resolveGate) => {
    releaseLoading = resolveGate;
  });
  const state: FixtureState = {
    apiRequests: [],
    chatBodies: [],
    consoleErrors: [],
    pageErrors: [],
    providerRequests: [],
    replyDelivered: false,
    releaseLoading,
  };

  page.on("console", (message) => {
    if (message.type() === "error") state.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => state.pageErrors.push(error.message));

  await page.addInitScript(
    ({ accessToken, refreshToken, helpKey }) => {
      window.localStorage.setItem("fittrack_access_token", accessToken);
      window.localStorage.setItem("fittrack_refresh_token", refreshToken);
      window.localStorage.setItem(helpKey, "1");
    },
    {
      accessToken: "chat-output-fixture-access-token",
      helpKey: "fittrack:auto-help-dismissed:" + MEMBER_ID + ":all",
      refreshToken: "chat-output-fixture-refresh-token",
    },
  );

  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (/openrouter|openai|anthropic|gemini|provider/i.test(url.hostname)) {
      state.providerRequests.push(method + " " + url.hostname + url.pathname);
      await route.abort("blockedbyclient");
      return;
    }

    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
      await route.continue();
      return;
    }

    if (!url.pathname.startsWith("/v1/")) {
      await route.continue();
      return;
    }

    const path = url.pathname;
    state.apiRequests.push(method + " " + path + url.search);

    if (method === "OPTIONS") {
      await route.fulfill({
        headers: {
          "access-control-allow-headers": "Authorization, Content-Type",
          "access-control-allow-methods": "GET, OPTIONS, PATCH, POST",
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
      path === "/v1/ai/chat/sessions/" + SESSION_ID + "/messages"
    ) {
      await route.fulfill({
        body: JSON.stringify(paginated(responseMessages(state), 100)),
        contentType: "application/json",
        status: 200,
      });
      return;
    }
    if (method === "GET" && path === "/v1/ai/chat/sessions/" + SESSION_ID) {
      await fulfill(route, sessionRecord);
      return;
    }
    if (method === "POST" && path === "/v1/ai/chat") {
      state.chatBodies.push(
        (request.postDataJSON() as ChatBody | null) ?? {},
      );

      if (mode === "reject-then-valid" && state.chatBodies.length === 1) {
        await route.fulfill({
          body: JSON.stringify({
            detail: "The AI chat service returned an invalid payload.",
            status: 502,
            title: "Invalid AI Chat Response",
            type: "BAD_GATEWAY",
          }),
          contentType: "application/json",
          status: 502,
        });
        return;
      }

      if (mode === "loading" && state.chatBodies.length === 1) {
        await loadingGate;
      }

      state.replyDelivered = true;
      await fulfill(
        route,
        {
          action_result: null,
          action_triggered: null,
          reply: VALID_REPLY,
          session_id: SESSION_ID,
        },
        201,
      );
      return;
    }

    await route.fulfill({
      body: JSON.stringify({
        detail: "Fixture denied an unconfigured API request.",
        status: 404,
        title: "Not Found",
        type: "NOT_FOUND",
      }),
      contentType: "application/json",
      status: 404,
    });
  });

  return state;
}

function isMobile(testInfo: TestInfo) {
  return testInfo.project.name.startsWith("mobile-");
}

function chatPath(testInfo: TestInfo) {
  return isMobile(testInfo)
    ? "/chatbot?sessionId=" + SESSION_ID + "&from=chathistory"
    : "/ai?sessionId=" + SESSION_ID;
}

function chatInput(page: Page, testInfo: TestInfo) {
  return isMobile(testInfo)
    ? page.getByLabel("Type a message", { exact: true })
    : page.locator("#brodigy-chat-message");
}

async function openChat(page: Page, testInfo: TestInfo, mode: FixtureMode) {
  const state = await installFixture(page, mode);
  await page.goto(chatPath(testInfo), { waitUntil: "domcontentloaded" });
  await expect(page.getByText(SESSION_TITLE, { exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await expect(chatInput(page, testInfo)).toBeVisible({ timeout: 20_000 });
  await stabilizeVisualPage(page);
  return state;
}

async function assertLayoutAndCapture(page: Page, testInfo: TestInfo) {
  const audit = await auditConventionalLayout(page);
  expect(audit.horizontalOverflow, "chat route horizontal overflow").toBe(false);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
    ),
    "document should not overflow horizontally",
  ).toBe(false);
  const screenshotPath = testInfo.outputPath("chat-output.png");
  await page.screenshot({ fullPage: true, path: screenshotPath });
  await testInfo.attach("chat-output.png", {
    contentType: "image/png",
    path: screenshotPath,
  });
}

function assertClosed(state: FixtureState) {
  expect(
    state.providerRequests,
    "provider routes must stay blocked and unused",
  ).toEqual([]);
  expect(state.pageErrors, "chat route page errors").toEqual([]);
}

test.describe("deterministic chat output boundaries", () => {
  test.describe.configure({ mode: "serial" });

  test("reopens history with invalid assistant text replaced and user text intact", async ({
    page,
  }, testInfo) => {
    const state = await openChat(page, testInfo, "history");

    await expect(page.getByText(HISTORY_USER, { exact: true })).toBeVisible();
    await expect(page.getByText(INVALID_HISTORY, { exact: true })).toHaveCount(0);
    await expect(page.getByText(FALLBACK, { exact: true })).toBeVisible();
    await expect(
      page.getByText("A clean saved assistant reply remains readable.", {
        exact: true,
      }),
    ).toBeVisible();

    await assertLayoutAndCapture(page, testInfo);
    assertClosed(state);
  });

  test("keeps valid send loading state deterministic before showing the reply", async ({
    page,
  }, testInfo) => {
    const state = await openChat(page, testInfo, "loading");
    const input = chatInput(page, testInfo);
    const send = page.getByRole("button", { name: "Send message", exact: true });

    await input.fill(USER_TEXT);
    await expect(input).toHaveValue(USER_TEXT);
    await expect(send).toBeEnabled();
    await send.click({ force: true });
    await expect.poll(() => state.chatBodies.length).toBe(1);
    const loading = page.locator(
      '[aria-busy="true"], [role="status"][aria-label*="thinking"]',
    );
    await expect(loading).toBeVisible();
    expect(state.chatBodies[0]?.message).toBe(USER_TEXT);

    state.releaseLoading?.();
    await expect(loading).toBeHidden({
      timeout: 15_000,
    });
    await expect(page.getByText(VALID_REPLY, { exact: true })).toBeVisible();
    await expect(input).toHaveValue("");
    await assertLayoutAndCapture(page, testInfo);
    assertClosed(state);
  });

  test("rejects a malformed send without a raw bubble and preserves a clean retry", async ({
    page,
  }, testInfo) => {
    const state = await openChat(page, testInfo, "reject-then-valid");
    const input = chatInput(page, testInfo);
    const send = page.getByRole("button", { name: "Send message", exact: true });

    await input.fill(USER_TEXT);
    await send.click({ force: true });
    await expect.poll(() => state.chatBodies.length).toBe(1);
    await expect(input).toHaveValue(USER_TEXT);
    await expect(page.getByText(INVALID_HISTORY, { exact: true })).toHaveCount(0);
    await expect(page.getByText("User Safety: safe", { exact: true })).toHaveCount(0);

    await send.click({ force: true });
    await expect.poll(() => state.chatBodies.length).toBe(2);
    expect(state.chatBodies[1]?.message).toBe(USER_TEXT);
    await expect(page.getByText(VALID_REPLY, { exact: true })).toBeVisible();
    await expect(input).toHaveValue("");

    await assertLayoutAndCapture(page, testInfo);
    assertClosed(state);
  });
});
