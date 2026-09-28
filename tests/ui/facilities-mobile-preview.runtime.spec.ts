import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

type Credential = { email: string; password: string; role: string };
type SnapshotNode = {
  name: string;
  image_url?: string | null;
};
type SnapshotFloor = {
  floor_id?: string;
  equipment?: SnapshotNode[];
  regions?: SnapshotNode[];
};
type SnapshotPayload = { floors?: SnapshotFloor[] };
type SnapshotResponse = SnapshotPayload & { data?: SnapshotPayload };

const manifestPath = resolve(process.cwd(), ".artifacts", "dynamic-seed-manifest.json");
const mobileBaseUrl = "http://127.0.0.1:8081";
const tinyDataImage =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function account(role: "member") {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    credentials: Credential[];
  };
  const credential = manifest.credentials.find((item) => item.role === role);
  if (!credential) throw new Error(`Missing ${role} test account.`);
  return credential;
}

async function loginMobileMember(page: Page) {
  const credential = await account("member");
  await page.goto(`${mobileBaseUrl}/login`);
  await page.getByLabel("Email").fill(credential.email);
  await page.getByRole("textbox", { name: "Password" }).fill(credential.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/home(?:\?|$)/, { timeout: 30_000 });
}

async function hold(locator: Locator, page: Page) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Unable to resolve the node bounds for the long-press gesture.");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(250);
  await page.mouse.up();
}

async function assertPreviewPosition(
  page: Page,
  image: Locator,
  nodeBox: { x: number; y: number; width: number; height: number },
) {
  const [imageBox, viewport] = await Promise.all([
    image.boundingBox(),
    page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight })),
  ]);
  if (!imageBox) throw new Error("Unable to resolve the larger facility image bounds.");

  const imageCenter = {
    x: imageBox.x + imageBox.width / 2,
    y: imageBox.y + imageBox.height / 2,
  };
  const viewportCenter = { x: viewport.width / 2, y: viewport.height / 2 };
  const displacement = {
    x: imageCenter.x - viewportCenter.x,
    y: imageCenter.y - viewportCenter.y,
  };

  expect(Math.abs(displacement.x)).toBeLessThanOrEqual(17);
  expect(Math.abs(displacement.y)).toBeLessThanOrEqual(13);

  const nodeCenter = {
    x: nodeBox.x + nodeBox.width / 2,
    y: nodeBox.y + nodeBox.height / 2,
  };
  const nodeDelta = {
    x: nodeCenter.x - viewportCenter.x,
    y: nodeCenter.y - viewportCenter.y,
  };
  if (Math.abs(nodeDelta.x) > 8) expect(Math.sign(displacement.x)).toBe(Math.sign(nodeDelta.x));
  if (Math.abs(nodeDelta.y) > 8) expect(Math.sign(displacement.y)).toBe(Math.sign(nodeDelta.y));
}

test("member facilities map supports accessible markers and bounded node image previews", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome");
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });

  let regionName: string | undefined;
  let equipmentName: string | undefined;
  await page.route("**/gym-layout/snapshot", async (route) => {
    const response = await route.fetch();
    const raw = (await response.json()) as SnapshotResponse;
    const payload = raw.data ?? raw;
    const targetFloor = payload.floors?.find(
      (floor) => floor.floor_id === "floor-1" && floor.regions?.[0] && floor.equipment?.[0],
    ) ?? payload.floors?.find((floor) => floor.regions?.[0] && floor.equipment?.[0]);
    const region = targetFloor?.regions?.[0];
    const equipment = targetFloor?.equipment?.[0];
    if (!region || !equipment) {
      throw new Error("Snapshot fixture contradiction: no floor contains both an existing region and equipment record.");
    }
    regionName = region.name;
    equipmentName = equipment.name;
    region.image_url = tinyDataImage;
    equipment.image_url = tinyDataImage;
    await route.fulfill({ response, json: raw });
  });

  await loginMobileMember(page);
  await page.goto(`${mobileBaseUrl}/facilities`);
  await expect(page.getByRole("button", { name: "Fit facility map" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Entrance", exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Exit", exact: true })).toBeVisible();

  if (!regionName || !equipmentName) {
    throw new Error("Snapshot interception did not expose deterministic region and equipment names.");
  }

  const region = page.getByRole("button", { name: `Open ${regionName} details`, exact: true }).first();
  await expect(region).toBeVisible();
  await region.click();
  await expect(page.getByText("Description", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  await expect(page.getByText("Description", { exact: true })).toHaveCount(0);

  const regionBox = await region.boundingBox();
  if (!regionBox) throw new Error("Unable to resolve the image-bearing facility node bounds.");
  await hold(region, page);
  const regionImage = page.getByRole("img", { name: `${regionName} larger image`, exact: true });
  await expect(regionImage).toBeVisible();
  await expect(page.getByText("Description", { exact: true })).toHaveCount(0);
  await assertPreviewPosition(page, regionImage, regionBox);
  await page.getByRole("button", { name: `Close larger image for ${regionName}`, exact: true }).click();
  await expect(regionImage).toHaveCount(0);

  const equipment = page.getByRole("button", { name: `Preview ${equipmentName} image`, exact: true }).first();
  await expect(equipment).toBeVisible();
  const equipmentBox = await equipment.boundingBox();
  if (!equipmentBox) throw new Error("Unable to resolve the image-bearing equipment node bounds.");
  await hold(equipment, page);
  const equipmentImage = page.getByRole("img", { name: `${equipmentName} larger image`, exact: true });
  await expect(equipmentImage).toBeVisible();
  await assertPreviewPosition(page, equipmentImage, equipmentBox);
  await page.getByRole("button", { name: `Close larger image for ${equipmentName}`, exact: true }).click();
  await expect(equipmentImage).toHaveCount(0);

  await page.screenshot({ fullPage: true, path: testInfo.outputPath("facilities-mobile-preview.png") });
});
