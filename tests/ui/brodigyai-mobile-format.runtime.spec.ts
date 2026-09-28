import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

type SeedCredential = {
  email: string;
  label?: string;
  password: string;
  role: string;
};

type SeedManifest = { credentials: SeedCredential[] };
type AiMockControl = {
  chatRequestSeen: () => boolean;
  getPostedBody: () => Record<string, unknown> | null;
  releaseChat: () => void;
};

const mobileBaseUrl =
  process.env.PLAYWRIGHT_MOBILE_BASE_URL ?? "http://127.0.0.1:8081";
const seedManifestPath = resolve(
  process.cwd(),
  ".artifacts",
  "dynamic-seed-manifest.json",
);

const sessionId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const timestamp = "2026-08-31T00:00:00.000Z";
const thinkingIndicatorTestId = "brodigyai-thinking-indicator";
const thinkingDotSelector = '[data-testid^="brodigyai-thinking-dot-"]';
const memberMarkerText = "Member wrote **member marker** literally.";
const submittedMessage = "I authored **member marker** literally.";
const longOrderedListItem =
  "This deliberately long ordered-list recommendation should wrap across lines at both supported mobile widths without clipping or horizontal overflow.";
const assistantText = [
  "**Protein** keeps this plan grounded.",
  "",
  `1. ${longOrderedListItem}`,
  "2. Keep the second step controlled before increasing load.",
].join("\n");

const sessionRecord = {
  context_type: "general",
  created_at: timestamp,
  id: sessionId,
  is_active: true,
  last_activity_at: timestamp,
  title: "Formatting proof",
  updated_at: timestamp,
  user_id: userId,
};

const initialMessages = [
  {
    action_triggered: null,
    content: memberMarkerText,
    created_at: timestamp,
    id: "33333333-3333-4333-8333-333333333333",
    role: "user",
    session_id: sessionId,
    updated_at: timestamp,
  },
  {
    action_triggered: null,
    content: assistantText,
    created_at: timestamp,
    id: "44444444-4444-4444-8444-444444444444",
    role: "assistant",
    session_id: sessionId,
    updated_at: timestamp,
  },
];

function paginated<T>(data: T[], limit: number) {
  return {
    data,
    meta: { limit, page: 1, total: data.length, total_pages: data.length ? 1 : 0 },
  };
}

async function readActiveMemberCredential() {
  const manifest = JSON.parse(
    await readFile(seedManifestPath, "utf8"),
  ) as SeedManifest;
  const credential = manifest.credentials.find(
    (candidate) =>
      candidate.role.toLowerCase() === "member" &&
      (candidate.label === "Member Active" ||
        candidate.email === "seed.member.active@fittrack.com"),
  );
  if (!credential) {
    throw new Error("The dynamic seed manifest does not contain the active member account.");
  }
  return credential;
}

async function loginMobileMember(page: Page) {
  const credential = await readActiveMemberCredential();
  await page.goto(`${mobileBaseUrl}/login`);
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await page.getByLabel("Email").fill(credential.email);
  await page.getByRole("textbox", { name: "Password" }).fill(credential.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/home(?:\?|$)/, { timeout: 30_000 });
}

async function installAiMocks(page: Page): Promise<AiMockControl> {
  let releaseChat!: () => void;
  const chatGate = new Promise<void>((resolveGate) => {
    releaseChat = resolveGate;
  });
  let chatRequestSeen = false;
  let postedBody: Record<string, unknown> | null = null;

  // The catch-all is installed first so an unexpected AI request cannot fall
  // through to the local or remote provider and make this proof nondeterministic.
  await page.route(/\/v1\/ai\/.*/, async (route) => {
    await route.abort("blockedbyclient");
  });

  await page.route(/\/v1\/ai\/chat\/sessions(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      body: JSON.stringify(paginated([sessionRecord], 50)),
      contentType: "application/json",
      status: 200,
    });
  });

  await page.route(/\/v1\/ai\/chat\/sessions\/[^/]+\/messages(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      body: JSON.stringify(paginated(initialMessages, 100)),
      contentType: "application/json",
      status: 200,
    });
  });

  await page.route(/\/v1\/ai\/chat\/sessions\/[^/]+(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      body: JSON.stringify({ data: sessionRecord }),
      contentType: "application/json",
      status: 200,
    });
  });

  await page.route(/\/v1\/ai\/chat\/?$/, async (route) => {
    chatRequestSeen = true;
    postedBody = route.request().postDataJSON() as Record<string, unknown>;
    await chatGate;
    await route.fulfill({
      body: JSON.stringify({
        data: {
          action_result: null,
          action_triggered: null,
          reply: "Thanks, I received that message.",
          session_id: sessionId,
        },
      }),
      contentType: "application/json",
      status: 201,
    });
  });

  return {
    chatRequestSeen: () => chatRequestSeen,
    getPostedBody: () => postedBody,
    releaseChat,
  };
}

async function dismissAutomaticHelp(page: Page) {
  const closeHelp = page.getByRole("button", { name: "Close help", exact: true });
  await expect(closeHelp).toBeVisible({ timeout: 5_000 }).catch(() => undefined);
  if (await closeHelp.isVisible().catch(() => false)) {
    await closeHelp.click();
    await expect(closeHelp).toBeHidden();
  }
}

async function dotStyles(page: Page) {
  return page.locator(thinkingDotSelector).evaluateAll((nodes) =>
    nodes.map((node) => {
      const style = window.getComputedStyle(node);
      return {
        animationDuration: style.animationDuration,
        animationName: style.animationName,
        animationPlayState: style.animationPlayState,
        opacity: style.opacity,
        transform: style.transform,
      };
    }),
  );
}

async function waitForDotStyleChange(
  page: Page,
  before: Awaited<ReturnType<typeof dotStyles>>,
) {
  await page.waitForFunction(
    ({ before, selector }) => {
      const current = Array.from(document.querySelectorAll<HTMLElement>(selector)).map(
        (node) => {
          const style = window.getComputedStyle(node);
          return {
            animationDuration: style.animationDuration,
            animationName: style.animationName,
            animationPlayState: style.animationPlayState,
            opacity: style.opacity,
            transform: style.transform,
          };
        },
      );
      return current.length === before.length && JSON.stringify(current) !== JSON.stringify(before);
    },
    { before, selector: thinkingDotSelector },
    { polling: "raf", timeout: 3_000 },
  );
}

async function expectDotStylesStaticAcrossRaf(page: Page) {
  await page.waitForFunction(
    ({ sampleCount, selector }) =>
      new Promise<boolean>((resolveStable) => {
        const read = () =>
          Array.from(document.querySelectorAll<HTMLElement>(selector)).map((node) => {
            const style = window.getComputedStyle(node);
            return [
              style.animationDuration,
              style.animationName,
              style.animationPlayState,
              style.opacity,
              style.transform,
            ].join("|");
          });
        const first = JSON.stringify(read());
        let samples = 0;
        const sample = () => {
          if (JSON.stringify(read()) !== first) {
            resolveStable(false);
            return;
          }
          samples += 1;
          if (samples >= sampleCount) {
            resolveStable(true);
            return;
          }
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }),
    { sampleCount: 6, selector: thinkingDotSelector },
    { polling: "raf", timeout: 3_000 },
  );
}

async function assertFormattedMessage(page: Page, width: number) {
  const formatted = page.getByTestId("brodigyai-formatted-text");
  await expect(formatted.first()).toBeVisible();
  const renderedAiText = await formatted.evaluateAll((nodes) =>
    nodes.map((node) => node.textContent ?? "").join("\n"),
  );
  expect(renderedAiText).not.toContain("**");

  const protein = formatted.getByText("Protein", { exact: true }).first();
  await expect(protein).toBeVisible();
  const proteinWeight = await protein.evaluate((node) => {
    const value = window.getComputedStyle(node).fontWeight;
    return value === "bold" ? 700 : Number.parseInt(value, 10);
  });
  expect(proteinWeight, "Protein should render with a bold semantic token").toBeGreaterThanOrEqual(600);

  const list = formatted.getByRole("list");
  await expect(list).toBeVisible();
  const firstListItem = list.getByText(longOrderedListItem, { exact: true });
  const secondListItem = list.getByText(
    "Keep the second step controlled before increasing load.",
    { exact: true },
  );
  await expect(firstListItem).toBeVisible();
  await expect(secondListItem).toBeVisible();
  const wrappedLineCount = await firstListItem.evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    return range.getClientRects().length;
  });
  expect(wrappedLineCount, `ordered list item should wrap at ${width}px`).toBeGreaterThan(1);

  const memberMessage = page.getByText(memberMarkerText, { exact: true }).first();
  await expect(memberMessage).toBeVisible();
  expect(await memberMessage.textContent()).toContain("**member marker**");
  expect(await memberMessage.locator("strong").count()).toBe(0);

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    `document horizontal overflow at ${width}px`,
  ).toBe(true);
}

async function openChat(
  page: Page,
  width: number,
  reducedMotion: "no-preference" | "reduce",
) {
  await page.emulateMedia({ reducedMotion });
  await page.setViewportSize({ width, height: 844 });
  const mocks = await installAiMocks(page);
  await loginMobileMember(page);
  await page.goto(
    `${mobileBaseUrl}/chatbot?sessionId=${sessionId}&from=chathistory`,
  );
  await expect(page).toHaveURL(/\/chatbot\?[^#]*sessionId=/);
  await dismissAutomaticHelp(page);
  await expect(page.getByText("Formatting proof", { exact: true })).toBeVisible();
  await expect(page.getByTestId("brodigyai-formatted-text").first()).toBeVisible();
  return mocks;
}

test.describe("mobile BrodigyAI formatting and thinking proof", () => {
  test.describe.configure({ mode: "serial" });

  for (const width of [390, 320] as const) {
    test(`renders formatted AI content and animated thinking at ${width}px`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "mobile-chrome", "Mobile Expo web proof only.");
      test.setTimeout(60_000);
      testInfo.annotations.push({
        type: "odiff",
        description: "N/A: deterministic runtime behavior proof; no approved screenshot baseline.",
      });

      const mocks = await openChat(page, width, "no-preference");
      await assertFormattedMessage(page, width);

      const input = page.getByLabel("Type a message", { exact: true });
      await input.fill(submittedMessage);
      await page.getByRole("button", { name: "Send message", exact: true }).click();
      const indicator = page.getByTestId(thinkingIndicatorTestId);
      try {
        await expect.poll(() => mocks.chatRequestSeen()).toBe(true);
        expect(mocks.getPostedBody()).toMatchObject({
          context_type: "general",
          message: submittedMessage,
          session_id: sessionId,
        });

        await expect(indicator).toBeVisible();
        await expect(indicator).toHaveAttribute("aria-busy", "true");
        await expect(
          page.getByText("BrodigyAI is thinking…", { exact: true }),
        ).toBeVisible();
        await expect(page.locator(thinkingDotSelector)).toHaveCount(3);
        await expect(input).not.toBeEditable();
        const before = await dotStyles(page);
        await waitForDotStyleChange(page, before);
      } finally {
        mocks.releaseChat();
      }
      await expect(indicator).toBeHidden();
    });
  }

  test("keeps the thinking indicator static under reduced motion", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "Mobile Expo web proof only.");
    test.setTimeout(60_000);
    testInfo.annotations.push({
      type: "odiff",
      description: "N/A: deterministic reduced-motion behavior proof; no approved screenshot baseline.",
    });

    const mocks = await openChat(page, 390, "reduce");
    const input = page.getByLabel("Type a message", { exact: true });
    await input.fill(submittedMessage);
    await page.getByRole("button", { name: "Send message", exact: true }).click();
    const indicator = page.getByTestId(thinkingIndicatorTestId);
    try {
      await expect.poll(() => mocks.chatRequestSeen()).toBe(true);
      await expect(indicator).toBeVisible();
      await expect(indicator).toHaveAttribute("aria-busy", "true");
      await expect(
        page.getByText("BrodigyAI is thinking…", { exact: true }),
      ).toBeVisible();
      await expect(page.locator(thinkingDotSelector)).toHaveCount(3);
      await expectDotStylesStaticAcrossRaf(page);
    } finally {
      mocks.releaseChat();
    }
    await expect(indicator).toBeHidden();
  });
});
