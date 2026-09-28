import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRenderableAssetUrl,
  extractStorageObjectKey,
} from "./profile.ts";

const assetKey = "uploads/users/user-1/2026/09/avatar image.png";
const encodedKey = encodeURIComponent(assetKey);

test("extracts and rebases absolute API render URLs", () => {
  const assetUrl =
    "https://api.fittrack.test/v1/files/render?key=" + encodedKey;

  assert.equal(extractStorageObjectKey(assetUrl), assetKey);
  assert.equal(
    buildRenderableAssetUrl({
      apiBaseUrl: "https://new-api.fittrack.test/v1",
      assetUrl,
    }),
    "https://new-api.fittrack.test/v1/files/render?key=" + encodedKey,
  );
});

test("rebases saved render URLs from an old local API origin", () => {
  const assetUrl = "http://localhost:3001/v1/files/render?key=" + encodedKey;

  assert.equal(
    buildRenderableAssetUrl({
      apiBaseUrl: "https://api.fittrack.test/v1",
      assetUrl,
    }),
    "https://api.fittrack.test/v1/files/render?key=" + encodedKey,
  );
});

test("extracts keys from relative API render URLs", () => {
  assert.equal(
    extractStorageObjectKey("/v1/files/render?key=" + encodedKey),
    assetKey,
  );
});

test("returns null for render URLs without a key", () => {
  assert.equal(
    extractStorageObjectKey("https://api.fittrack.test/v1/files/render?key="),
    null,
  );
  assert.equal(extractStorageObjectKey("/v1/files/render"), null);
});

test("preserves existing R2, public, blob, placeholder, and external behavior", () => {
  assert.equal(
    extractStorageObjectKey("https://bucket.r2.dev/" + encodedKey),
    assetKey,
  );
  assert.equal(
    extractStorageObjectKey(
      "https://cdn.fittrack.test/" + encodedKey,
      "https://cdn.fittrack.test",
    ),
    assetKey,
  );
  assert.equal(
    buildRenderableAssetUrl({
      apiBaseUrl: "https://api.fittrack.test/v1",
      assetUrl: "blob:local-preview",
    }),
    "blob:local-preview",
  );
  assert.equal(
    buildRenderableAssetUrl({
      apiBaseUrl: "https://api.fittrack.test/v1",
      assetUrl: "https://fittrack.local/v1/files/render?key=" + encodedKey,
    }),
    null,
  );
  assert.equal(
    extractStorageObjectKey("https://images.example.test/avatar.png"),
    null,
  );
});
