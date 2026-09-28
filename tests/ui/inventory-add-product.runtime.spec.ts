import { expect, test, type Locator, type Page, type Route } from "@playwright/test";

const ADMIN_ID = "88888888-8888-4888-8888-888888888888";
const UPLOAD_URL = "/inventory-upload.png";
const PRODUCT_ID_PREFIX = "aaaaaaaa-aaaa-4aaa-8aaa-";
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

type FixtureState = {
  consoleErrors: string[];
  expectedUploadFailures: number;
  failNextUpload: boolean;
  holdNextUpload: boolean;
  releaseUpload: (() => void) | null;
  products: Array<Record<string, unknown>>;
  createBodies: Array<Record<string, unknown>>;
  uploadCount: number;
  unhandled: string[];
};

function createFixtureState(): FixtureState {
  return {
    consoleErrors: [],
    expectedUploadFailures: 0,
    failNextUpload: false,
    holdNextUpload: false,
    releaseUpload: null,
    products: [],
    createBodies: [],
    uploadCount: 0,
    unhandled: [],
  };
}

function userProfile() {
  return {
    email: "inventory-upload-admin@fittrack.test",
    email_verified: true,
    has_accepted_privacy: true,
    id: ADMIN_ID,
    membership_card: null,
    profile: {
      first_name: "Ada",
      last_name: "Inventory Admin",
    },
    role: "ADMIN",
    status: "active",
  };
}

function productRecord(index: number, input: Record<string, unknown> = {}) {
  return {
    category: String(input.category ?? "other"),
    cost: Number(input.cost ?? 50),
    created_at: "2026-09-11T00:00:00.000Z",
    description: (input.description as string | null | undefined) ?? null,
    id: `${PRODUCT_ID_PREFIX}${String(index).padStart(12, "0")}`,
    image_url: (input.image_url as string | null | undefined) ?? null,
    is_active: true,
    name: String(input.name ?? `Fixture product ${index}`),
    price: Number(input.price ?? 100),
    reorder_threshold: Number(input.reorder_threshold ?? 10),
    stock_quantity: Number(input.stock_quantity ?? 5),
    updated_at: "2026-09-11T00:00:00.000Z",
  };
}

function corsHeaders(route: Route) {
  const origin = route.request().headers().origin;
  return {
    "access-control-allow-credentials": "true",
    "access-control-allow-headers":
      route.request().headers()["access-control-request-headers"] ?? "authorization,content-type",
    "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    ...(origin ? { "access-control-allow-origin": origin } : {}),
  };
}

async function fulfillJson(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    body: JSON.stringify(status >= 400 ? data : { data }),
    contentType: "application/json",
    headers: corsHeaders(route),
    status,
  });
}

async function fulfillPage(route: Route, data: unknown[], url: URL) {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const limit = Math.max(1, Number(url.searchParams.get("limit") ?? "100"));
  const start = (page - 1) * limit;
  await route.fulfill({
    body: JSON.stringify({
      data: data.slice(start, start + limit),
      meta: {
        limit,
        page,
        total: data.length,
        total_pages: data.length ? Math.ceil(data.length / limit) : 0,
      },
    }),
    contentType: "application/json",
    headers: corsHeaders(route),
    status: 200,
  });
}

function requestBody(route: Route) {
  try {
    return (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function installFixture(page: Page, fixture: FixtureState) {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (fixture.expectedUploadFailures > 0 && message.text().includes("500")) {
      fixture.expectedUploadFailures -= 1;
      return;
    }
    fixture.consoleErrors.push(message.text());
  });

  await page.addInitScript(({ adminId }) => {
    window.localStorage.setItem("fittrack_access_token", "inventory-upload-fixture-token");
    window.localStorage.setItem("fittrack_refresh_token", "inventory-upload-fixture-refresh");
    window.localStorage.setItem(
      `fittrack_prefs_${adminId}`,
      JSON.stringify({ themeKey: "night", fontKey: "standard", animationLevel: "none" }),
    );
  }, { adminId: ADMIN_ID });

  await page.route("**/inventory-upload.png", async (route) => {
    await route.fulfill({
      body: PNG_BYTES,
      contentType: "image/png",
      status: 200,
    });
  });

  await page.route("**/v1/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;

    if (method === "OPTIONS") {
      await route.fulfill({ headers: corsHeaders(route), status: 204 });
      return;
    }

    if (method === "GET" && path === "/v1/users/me") {
      await fulfillJson(route, userProfile());
      return;
    }
    if (method === "GET" && path === "/v1/notifications/my") {
      await fulfillPage(route, [], url);
      return;
    }
    if (method === "GET" && path === "/v1/notifications/unread-count") {
      await fulfillJson(route, { count: 0 });
      return;
    }
    if (method === "GET" && path === "/v1/inventory/products") {
      await fulfillPage(route, fixture.products, url);
      return;
    }
    if (method === "GET" && path === "/v1/inventory/equipment") {
      await fulfillPage(route, [], url);
      return;
    }
    if (method === "GET" && path === "/v1/inventory/sales") {
      await fulfillPage(route, [], url);
      return;
    }
    if (method === "GET" && path === "/v1/inventory/sales/summary") {
      await fulfillJson(route, { completed_sales_count: 0, total_revenue: 0 });
      return;
    }
    if (method === "GET" && path === "/v1/inventory/sales/analytics") {
      await fulfillJson(route, {
        period: "Monthly",
        revenue_series: [],
        top_products_by_inventory_value: [],
        top_products_by_stocks_sold: [],
      });
      return;
    }
    if (method === "POST" && path === "/v1/files/upload") {
      fixture.uploadCount += 1;
      if (fixture.holdNextUpload) {
        fixture.holdNextUpload = false;
        await new Promise<void>((resolve) => {
          fixture.releaseUpload = resolve;
        });
        fixture.releaseUpload = null;
      }
      if (fixture.failNextUpload) {
        fixture.failNextUpload = false;
        fixture.expectedUploadFailures += 1;
        await fulfillJson(route, { detail: "Synthetic inventory upload failure" }, 500);
        return;
      }
      await fulfillJson(route, {
        file_key: "inventory/fixture.png",
        mime_type: "image/png",
        original_filename: "fixture.png",
        size_bytes: PNG_BYTES.length,
        url: UPLOAD_URL,
      });
      return;
    }
    if (method === "POST" && path === "/v1/inventory/products") {
      const body = requestBody(route);
      fixture.createBodies.push(body);
      const next = productRecord(fixture.products.length + 1, {
        category: body.category,
        cost: body.cost,
        description: body.description,
        image_url: body.image_url,
        name: body.name,
        price: body.price,
        reorder_threshold: body.reorder_threshold,
        stock_quantity: body.stock_quantity,
      });
      fixture.products.unshift(next);
      await fulfillJson(route, next);
      return;
    }

    fixture.unhandled.push(`${method} ${path}${url.search}`);
    await fulfillJson(route, { detail: `Unhandled fixture request: ${method} ${path}` }, 599);
  });
}

async function openAddProduct(page: Page) {
  await page.getByRole("button", { name: "ADD PRODUCT", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add Retail Product", exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function fillProduct(page: Page, dialog: Locator, name: string) {
  await dialog.getByLabel("Product Name", { exact: true }).fill(name);
  await dialog.getByRole("button", { name: "Select Category: Other", exact: true }).click();
  await page.getByRole("menuitem", { name: "Other", exact: true }).click();
  await expect(dialog.locator('input[name="category"]')).toHaveValue("other");
  await dialog.getByLabel("Price (PHP)", { exact: true }).fill("100");
  await dialog.getByLabel("Cost (PHP)", { exact: true }).fill("50");
  await dialog.getByLabel("Stock Quantity", { exact: true }).fill("5");
  await dialog.getByLabel("Reorder Threshold", { exact: true }).fill("2");
}

test("Add Retail Product keeps image optional and resilient", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  test.skip(testInfo.project.name !== "desktop-chrome", "Focused inventory runtime lane targets desktop web.");

  const fixture = createFixtureState();
  await installFixture(page, fixture);
  await page.goto("/inventory", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/inventory(?:\?|$)/);
  await expect(page.getByText("Inventory", { exact: true }).first()).toBeVisible();

  let dialog = await openAddProduct(page);
  await expect(dialog.getByText(/Optional\./, { exact: false })).toBeVisible();
  await expect(dialog.locator("img")).toHaveCount(0);
  await expect(dialog.getByText(/image is required/i)).toHaveCount(0);

  await fillProduct(page, dialog, "No image product");
  const firstSubmit = dialog.getByRole("button", { name: "ADD PRODUCT", exact: true });
  await expect(firstSubmit).toBeEnabled();
  await expect(dialog.getByLabel("Product Name", { exact: true })).toHaveValue("No image product");
  await expect(dialog.getByLabel("Price (PHP)", { exact: true })).toHaveValue("100");
  await expect(dialog.getByLabel("Cost (PHP)", { exact: true })).toHaveValue("50");
  await expect(dialog.getByLabel("Stock Quantity", { exact: true })).toHaveValue("5");
  await expect(dialog.getByLabel("Reorder Threshold", { exact: true })).toHaveValue("2");
  await firstSubmit.click();
  await expect.poll(() => fixture.createBodies.length).toBe(1);
  await expect(dialog).toBeHidden();
  expect(fixture.createBodies[0]).not.toHaveProperty("image_url");
  expect(fixture.createBodies[0]).not.toHaveProperty("imageUrl");
  await expect(page.getByText("No image product added to retail inventory.", { exact: true })).toBeVisible();

  dialog = await openAddProduct(page);
  await fillProduct(page, dialog, "Uploaded product");
  fixture.holdNextUpload = true;
  const uploadInput = dialog.locator('input[type="file"]');
  await uploadInput.setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: PNG_BYTES });
  await expect(dialog.locator('img[src^="blob:"]')).toHaveCount(1);
  const uploadStatus = dialog.getByRole("status");
  await expect(uploadStatus).toContainText(/Uploading image/i);
  await expect(dialog.getByRole("button", { name: "ADD PRODUCT", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "UPLOADING...", exact: true })).toBeDisabled();
  expect(fixture.createBodies).toHaveLength(1);
  expect(fixture.uploadCount).toBe(1);

  fixture.releaseUpload?.();
  await expect(uploadStatus).toBeHidden();
  await expect(dialog.locator(`img[src="${UPLOAD_URL}"]`)).toBeVisible();
  await dialog.getByRole("button", { name: "ADD PRODUCT", exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(fixture.createBodies[1]).toHaveProperty("image_url", UPLOAD_URL);

  dialog = await openAddProduct(page);
  await fillProduct(page, dialog, "Failed upload product");
  fixture.failNextUpload = true;
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "failed.png",
    mimeType: "image/png",
    buffer: PNG_BYTES,
  });
  await expect(dialog.getByRole("status")).toContainText(/Image upload failed/i);
  await expect(dialog.locator("img")).toHaveCount(0);
  const retryableSubmit = dialog.getByRole("button", { name: "ADD PRODUCT", exact: true });
  await expect(retryableSubmit).toBeEnabled();
  await retryableSubmit.click();
  await expect(dialog).toBeHidden();
  expect(fixture.createBodies[2]).not.toHaveProperty("image_url");
  await expect(page.getByText("Failed upload product added to retail inventory.", { exact: true })).toBeVisible();

  expect(fixture.unhandled, fixture.unhandled.join("\n")).toEqual([]);
  expect(fixture.consoleErrors, fixture.consoleErrors.join("\n")).toEqual([]);
  expect(fixture.expectedUploadFailures).toBe(0);
});
