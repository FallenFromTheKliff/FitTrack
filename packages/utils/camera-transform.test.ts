import assert from "node:assert/strict";
import test from "node:test";

import {
  cameraRotationFromOrientation,
  createCoverCropTransform,
  type CameraFrameOrientation,
} from "./camera-transform.ts";

test("maps native frame orientations to clockwise preview rotations", () => {
  assert.equal(cameraRotationFromOrientation("portrait"), 0);
  assert.equal(cameraRotationFromOrientation("portrait-upside-down"), 180);
  assert.equal(cameraRotationFromOrientation("landscape-right"), 90);
  assert.equal(cameraRotationFromOrientation("landscape-left"), 270);
});

test("projects portrait landmarks into the same cover preview space", () => {
  const transform = createCoverCropTransform({
    frameHeight: 200,
    frameWidth: 100,
    viewportHeight: 200,
    viewportWidth: 100,
  });

  assert.deepEqual(transform.point({ x: 0.2, y: 0.3 }), { x: 0.2, y: 0.3 });
  assert.deepEqual(transform.rect({ height: 0.2, width: 0.3, x: 0.2, y: 0.3 }), {
    height: 0.2,
    width: 0.3,
    x: 0.2,
    y: 0.3,
  });
});

test("projects rotated landscape landmarks and keeps front mirroring aligned", () => {
  const rotated = createCoverCropTransform({
    frameHeight: 100,
    frameWidth: 200,
    rotation: 90,
    viewportHeight: 200,
    viewportWidth: 100,
  });
  const mirrored = createCoverCropTransform({
    frameHeight: 100,
    frameWidth: 200,
    mirrorX: true,
    rotation: 90,
    viewportHeight: 200,
    viewportWidth: 100,
  });

  assert.deepEqual(rotated.point({ x: 0.2, y: 0.3 }), { x: 0.7, y: 0.2 });
  const mirroredPoint = mirrored.point({ x: 0.2, y: 0.3 });
  assert.ok(Math.abs(mirroredPoint.x - 0.3) < 1e-9);
  assert.equal(mirroredPoint.y, 0.2);
});

test("projects every native orientation into the matching preview space", () => {
  const cases: Array<{
    orientation: CameraFrameOrientation;
    expected: { x: number; y: number };
    viewportHeight: number;
    viewportWidth: number;
  }> = [
    {
      orientation: "portrait",
      expected: { x: 0.2, y: 0.3 },
      viewportHeight: 100,
      viewportWidth: 200,
    },
    {
      orientation: "landscape-right",
      expected: { x: 0.7, y: 0.2 },
      viewportHeight: 200,
      viewportWidth: 100,
    },
    {
      orientation: "portrait-upside-down",
      expected: { x: 0.8, y: 0.7 },
      viewportHeight: 100,
      viewportWidth: 200,
    },
    {
      orientation: "landscape-left",
      expected: { x: 0.3, y: 0.8 },
      viewportHeight: 200,
      viewportWidth: 100,
    },
  ];

  for (const testCase of cases) {
    const transform = createCoverCropTransform({
      frameHeight: 100,
      frameWidth: 200,
      rotation: cameraRotationFromOrientation(testCase.orientation),
      viewportHeight: testCase.viewportHeight,
      viewportWidth: testCase.viewportWidth,
    });
    assert.deepEqual(transform.point({ x: 0.2, y: 0.3 }), testCase.expected);

    const mirrored = createCoverCropTransform({
      frameHeight: 100,
      frameWidth: 200,
      mirrorX: true,
      rotation: cameraRotationFromOrientation(testCase.orientation),
      viewportHeight: testCase.viewportHeight,
      viewportWidth: testCase.viewportWidth,
    });
    assert.deepEqual(mirrored.point({ x: 0.2, y: 0.3 }), {
      x: 1 - testCase.expected.x,
      y: testCase.expected.y,
    });
  }
});

test("centers the source subject after cover cropping at portrait phone sizes", () => {
  const transform = createCoverCropTransform({
    frameHeight: 1080,
    frameWidth: 1920,
    viewportHeight: 456,
    viewportWidth: 320,
  });

  assert.deepEqual(transform.point({ x: 0.5, y: 0.5 }), { x: 0.5, y: 0.5 });
  assert.deepEqual(transform.point({ x: 0, y: 0 }), { x: 0, y: 0 });
  assert.deepEqual(transform.point({ x: 1, y: 1 }), { x: 1, y: 1 });
});
