import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_VENUE_IMAGES,
  moveVenueImage,
  normalizeVenueImageUrls,
  parseVenueImageUrls,
  serializeVenueImageUrls,
} from "./venueImageGallery";

void test("venue gallery keeps the primary image first and bounds the collection", () => {
  const urls = normalizeVenueImageUrls({
    imageUrl: " /cover.jpg ",
    imageUrls: ["/detail.jpg", "/cover.jpg", ...Array.from({ length: 8 }, (_, index) => `/extra-${index}.jpg`)],
  });

  assert.equal(urls[0], "/cover.jpg");
  assert.equal(urls.length, MAX_VENUE_IMAGES);
  assert.equal(new Set(urls).size, urls.length);
});

void test("venue gallery parses and serializes the admin form collection", () => {
  const serialized = serializeVenueImageUrls(["/one.jpg", "/two.jpg"]);
  assert.deepEqual(parseVenueImageUrls(serialized), ["/one.jpg", "/two.jpg"]);
  assert.deepEqual(parseVenueImageUrls("not-json"), []);
});

void test("venue gallery moves an image without disturbing no-op placement", () => {
  const initial = ["/cover.jpg", "/detail-one.jpg", "/detail-two.jpg"];

  assert.deepEqual(moveVenueImage(initial, 1, 0), [
    "/detail-one.jpg",
    "/cover.jpg",
    "/detail-two.jpg",
  ]);
  assert.deepEqual(moveVenueImage(initial, 1, 1), initial);
  assert.deepEqual(moveVenueImage(initial, -1, 0), initial);
});
