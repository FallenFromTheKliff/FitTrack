import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyExerciseCameraError,
  exerciseCameraModelError,
  formatExerciseCameraErrorLabel,
} from "./exerciseCameraErrors";

test("classifies cross-realm media failures with actionable states", () => {
  assert.equal(
    classifyExerciseCameraError({ name: "NotAllowedError" }).kind,
    "permission",
  );
  assert.equal(
    classifyExerciseCameraError({ name: "SecurityError" }).kind,
    "permission",
  );
  assert.equal(
    classifyExerciseCameraError({ name: "NotFoundError" }).kind,
    "no-device",
  );
  assert.equal(
    classifyExerciseCameraError({ name: "NotReadableError" }).kind,
    "busy",
  );
  assert.equal(
    classifyExerciseCameraError({ name: "TypeError", message: "insecure origin" })
      .kind,
    "unsupported",
  );
  assert.match(
    classifyExerciseCameraError({ name: "NotAllowedError" }).message,
    /allow camera access/i,
  );
});

test("keeps model failures distinct from media permission failures", () => {
  const model = exerciseCameraModelError();
  assert.equal(model.kind, "model");
  assert.equal(formatExerciseCameraErrorLabel(model.kind), "Pose model unavailable");
});
