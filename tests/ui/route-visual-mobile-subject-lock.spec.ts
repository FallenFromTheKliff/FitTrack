import { expect, test, type Locator, type Page, type Route, type TestInfo } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  auditConventionalLayout,
  stabilizeVisualPage,
} from "./visual-stabilizer";

test.use({
  permissions: ["camera"],
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
    ],
  },
});

const MOBILE_BASE_URL = "http://127.0.0.1:8081";
const FIXED_NOW = Date.parse("2026-09-08T08:00:00.000Z");
const MEMBER_ID = "22222222-2222-4222-8222-222222222222";
const PLAN_ID = "plan-subject-lock-fixture";
const PLAN_EXERCISE_ID = "plan-exercise-subject-lock-fixture";
const EXERCISE_ID = "exercise-push-up-subject-lock-fixture";
const SESSION_ID = "session-subject-lock-fixture";
const POSE_SESSION_ID = "pose-subject-lock-fixture";
const EXERCISE_NAME = "Push-Up";

const mobileViewports = [
  "mobile-320x844",
  "mobile-390x844",
  "mobile-430x932",
] as const;

type PosePhase = "valid" | "rock" | "lost" | "jump" | "broken";
type HandProfileVariant =
  | "full"
  | "grip-only"
  | "nested-null"
  | "partial-disabled"
  | "snake-case";

type FixtureState = {
  gestureEnabled: boolean;
  gestureHoldMs: number;
  handProfileVariant: HandProfileVariant;
  analysisDelayMs: number;
  observedRequests: string[];
  consoleErrors: string[];
  pageErrors: string[];
  mutations: Array<{ method: string; path: string; body: unknown }>;
  analysisBodies: unknown[];
  unhandled: string[];
  phase: PosePhase;
  sessionStatus: "in_progress" | "completed";
  logs: unknown[];
  poseStarted: boolean;
};

function newFixtureState(
  overrides: Partial<
    Pick<
      FixtureState,
      | "gestureEnabled"
      | "gestureHoldMs"
      | "handProfileVariant"
      | "analysisDelayMs"
    >
  > = {},
): FixtureState {
  return {
    analysisBodies: [],
    analysisDelayMs: 0,
    consoleErrors: [],
    gestureEnabled: true,
    gestureHoldMs: 3000,
    handProfileVariant: "full",
    logs: [],
    mutations: [],
    observedRequests: [],
    pageErrors: [],
    phase: "valid",
    poseStarted: false,
    sessionStatus: "in_progress",
    unhandled: [],
    ...overrides,
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
  meta: { page: number; limit: number; total: number; total_pages: number },
) {
  await route.fulfill({
    body: JSON.stringify({ data: records, meta }),
    contentType: "application/json",
    status: 200,
  });
}

function movementContract() {
  return {
    body_orientation: "horizontal",
    contract_version: "pose_movement_contract_v2",
    degraded_conditions: [
      "left_arm_occluded",
      "right_arm_occluded",
      "body_line_failure",
      "phase_desync",
    ],
    dominant_joint: "elbow",
    exercise: "push_up",
    no_count_conditions: [
      "bilateral_arm_motion_unconfirmed",
      "push_up_body_not_horizontal",
      "body_line_failure",
      "left_right_phase_desync",
    ],
    oscillating_joints: ["elbow", "shoulder"],
    partial_rep_policy: "strict_full_rep",
    phase_order: ["setup", "down", "up"],
    primary_joints: ["left_elbow", "right_elbow"],
    rep_model: "bilateral",
    rep_thresholds: {
      down: { angle: 90, tolerance: 15 },
      up: { angle: 155, tolerance: 12 },
    },
    required_sides: "both",
    secondary_check: "body_line",
    secondary_joints: ["left_shoulder", "right_shoulder", "hip"],
    spatial_requirements: {
      body_line_tolerance: 86,
      body_x_drift_max: 0.22,
      body_y_travel_min: 0.012,
      hip_y_travel_min: 0.01,
      left_right_symmetry_tolerance: 85,
      phase_sync_tolerance_ms: 650,
      shoulder_hip_travel_min: 0.01,
      shoulder_y_travel_min: 0.008,
      torso_slope_max_deg: 92,
      torso_slope_min_deg: 0,
      wrist_anchor_drift_max: 0.18,
    },
    tracking_requirements: {
      min_confidence: 0.6,
      min_reliable_frame_landmarks: 12,
      required_landmarks: ["shoulders", "elbows", "wrists", "hips", "ankles"],
      required_sides: "both",
    },
  };
}

function clientMovementContract() {
  const contract = movementContract();
  return {
    bodyOrientation: contract.body_orientation,
    contractVersion: contract.contract_version,
    degradedConditions: contract.degraded_conditions,
    dominantJoint: contract.dominant_joint,
    exercise: contract.exercise,
    noCountConditions: contract.no_count_conditions,
    oscillatingJoints: contract.oscillating_joints,
    partialRepPolicy: contract.partial_rep_policy,
    phaseOrder: contract.phase_order,
    primaryJoints: contract.primary_joints,
    repModel: contract.rep_model,
    repThresholds: contract.rep_thresholds,
    requiredSides: contract.required_sides,
    secondaryCheck: contract.secondary_check,
    secondaryJoints: contract.secondary_joints,
    spatialRequirements: {
      bodyLineTolerance: contract.spatial_requirements.body_line_tolerance,
      bodyXDriftMax: contract.spatial_requirements.body_x_drift_max,
      bodyYTravelMin: contract.spatial_requirements.body_y_travel_min,
      hipYTravelMin: contract.spatial_requirements.hip_y_travel_min,
      leftRightSymmetryTolerance:
        contract.spatial_requirements.left_right_symmetry_tolerance,
      phaseSyncToleranceMs: contract.spatial_requirements.phase_sync_tolerance_ms,
      shoulderHipTravelMin: contract.spatial_requirements.shoulder_hip_travel_min,
      shoulderYTravelMin: contract.spatial_requirements.shoulder_y_travel_min,
      torsoSlopeMaxDeg: contract.spatial_requirements.torso_slope_max_deg,
      torsoSlopeMinDeg: contract.spatial_requirements.torso_slope_min_deg,
      wristAnchorDriftMax: contract.spatial_requirements.wrist_anchor_drift_max,
    },
    trackingRequirements: {
      minConfidence: contract.tracking_requirements.min_confidence,
      minReliableFrameLandmarks:
        contract.tracking_requirements.min_reliable_frame_landmarks,
      requiredLandmarks: contract.tracking_requirements.required_landmarks,
      requiredSides: contract.tracking_requirements.required_sides,
    },
  };
}

function handShapeProfile(state: FixtureState) {
  const grip = {
    maxOpenFrames: 0,
    maxOpenRatio: 0.18,
    minUsableFrames: 2,
    recentFrameLimit: 6,
    reliablePointMinVisibility: 0.36,
    required: false,
  };
  const subjectLockGesture = {
    enabled: state.gestureEnabled,
    gesture: "rock_sign",
    handAboveShoulderOffset: 0.018,
    handRaisedFromElbowOffset: 0.018,
    holdMs: state.gestureHoldMs,
    hornThumbLeadOffset: 0.025,
    maxHornLiftDelta: 0.08,
    minFingerDistance: 0.045,
    minFingerLift: 0.035,
    minFingerSpreadX: 0.025,
    minThumbOffset: 0.012,
    minThumbSeparation: 0.025,
  };

  switch (state.handProfileVariant) {
    case "grip-only":
      return { grip };
    case "nested-null":
      return {
        grip: null,
        handPosePreview: null,
        subjectLockGesture: null,
      };
    case "partial-disabled":
      return {
        grip,
        subjectLockGesture: {
          enabled: false,
          holdMs: state.gestureHoldMs,
        },
      };
    case "snake-case":
      return {
        grip: {
          max_open_frames: grip.maxOpenFrames,
          max_open_ratio: grip.maxOpenRatio,
          min_usable_frames: grip.minUsableFrames,
          recent_frame_limit: grip.recentFrameLimit,
          reliable_point_min_visibility: grip.reliablePointMinVisibility,
          required: grip.required,
        },
        hand_pose_preview: null,
        schema_version: "exercise_hand_shape_v1",
        subject_lock_gesture: {
          enabled: state.gestureEnabled,
          gesture: "rock_sign",
          hand_above_shoulder_offset: 0.018,
          hand_raised_from_elbow_offset: 0.018,
          hold_ms: state.gestureHoldMs,
          horn_thumb_lead_offset: 0.025,
          max_horn_lift_delta: 0.08,
          min_finger_distance: 0.045,
          min_finger_lift: 0.035,
          min_finger_spread_x: 0.025,
          min_thumb_offset: 0.012,
          min_thumb_separation: 0.025,
        },
        warnings: [],
      };
    default:
      return {
        grip,
        handPosePreview: null,
        schemaVersion: "exercise_hand_shape_v1",
        subjectLockGesture,
        warnings: [],
      };
  }
}

function exerciseRecord(state: FixtureState) {
  return {
    aliases: [
      {
        id: `${EXERCISE_ID}-alias`,
        kind: "synonym",
        label: "pushup",
        normalized_label: "pushup",
      },
    ],
    category: "strength",
    created_at: "2026-09-01T00:00:00.000Z",
    description: "Controlled fixture movement for subject lock coverage.",
    hand_shape_profile: handShapeProfile(state),
    id: EXERCISE_ID,
    image_url: null,
    instructions: "Keep a straight body line and move through a controlled range.",
    is_active: true,
    movement_profile: {
      movementContract: clientMovementContract(),
      rig: null,
      schemaVersion: "exercise_movement_profile_v1",
      warnings: [],
    },
    movement_contract_identity: {
      exerciseId: EXERCISE_ID,
      familyKey: "push_up",
      revision: 1,
      source: "manual",
      trackingMode: "override",
    },
    movement_family: null,
    muscle_group: "Chest",
    muscle_targets: [],
    name: EXERCISE_NAME,
    tracking_mode: "override",
    updated_at: "2026-09-01T00:00:00.000Z",
    video_url: null,
  };
}

function planExercise() {
  return {
    category: "strength",
    duration_seconds: null,
    exercise_id: EXERCISE_ID,
    exercise_name: EXERCISE_NAME,
    id: PLAN_EXERCISE_ID,
    muscle_group: "Chest",
    notes: null,
    order_index: 0,
    reps: 8,
    rest_seconds: 0,
    rest_seconds_by_set: [0],
    sets: 1,
    weight_kg_target: null,
  };
}

function planRecord() {
  const days = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    day_of_week: dayOfWeek,
    exercises: [planExercise()],
    focus_label: "Subject lock fixture",
    id: `${PLAN_ID}-day-${dayOfWeek}`,
    is_rest_day: false,
    notes: null,
    week_number: 1,
  }));
  return {
    coach_id: null,
    created_at: "2026-09-08T00:00:00.000Z",
    days_per_week: 7,
    duration_weeks: 1,
    goal: "maintenance",
    id: PLAN_ID,
    is_active: true,
    is_template: false,
    schedule_days: days,
    source: "self_created",
    title: "Subject lock fixture plan",
    updated_at: "2026-09-08T00:00:00.000Z",
    user_id: MEMBER_ID,
  };
}

function sessionSummary(state: FixtureState) {
  return {
    cancelled_at: null,
    completed_at: state.sessionStatus === "completed" ? "2026-09-08T08:05:00.000Z" : null,
    created_at: "2026-09-08T08:00:00.000Z",
    duration_seconds: null,
    exercise_log_count: state.logs.length,
    id: SESSION_ID,
    last_activity_at: "2026-09-08T08:00:00.000Z",
    plan: {
      goal: "maintenance",
      id: PLAN_ID,
      source: "self_created",
      title: "Subject lock fixture plan",
    },
    plan_id: PLAN_ID,
    started_at: "2026-09-08T08:00:00.000Z",
    status: state.sessionStatus,
    total_volume_kg: null,
    updated_at: "2026-09-08T08:00:00.000Z",
    user_id: MEMBER_ID,
  };
}

function sessionDetail(state: FixtureState) {
  return {
    ...sessionSummary(state),
    exercise_logs: state.logs,
  };
}

function poseAnalysis(state: FixtureState, body: Record<string, unknown>) {
  return {
    candidate_exercises: [EXERCISE_NAME],
    classification_source: "preset",
    confidence: 0.94,
    exercise_class: "strength",
    form_feedback: ["Keep a straight body line."],
    integrity_reason_codes: [],
    keypoints: Array.isArray(body.frames) ? body.frames.at(-1)?.keypoints ?? null : null,
    matched_profile_id: EXERCISE_ID,
    movement_contract: movementContract(),
    movement_contract_identity: {
      exercise_id: EXERCISE_ID,
      family_key: "push_up",
      revision: 1,
      source: "manual",
      tracking_mode: "override",
    },
    needs_confirmation: false,
    phase: "setup",
    pose_session_id: POSE_SESSION_ID,
    processing_mode: "sequence",
    progression_disposition: "eligible",
    reliable_frame_ratio: 1,
    rep_count_delta: 0,
    rep_event: false,
    review_recommended: false,
    session_quality_reasons: [],
    session_quality_state: "stable",
    subject_lock_confidence: body.subject_locked ? 0.94 : 0,
    subject_locked: body.subject_locked === true,
  };
}

async function installWorkoutFixtures(page: Page, state: FixtureState) {
  page.on("console", (message) => {
    if (message.type() === "error") state.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    state.consoleErrors.push(error.message);
    state.pageErrors.push(error.message);
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes("/v1/")) {
      state.observedRequests.push(`${request.method()} ${url.pathname}${url.search}`);
    }
  });

  await page.addInitScript((fixedBaseMs) => {
    const nativeDateNow = Date.now.bind(Date);
    const nativeStartMs = nativeDateNow();
    let offsetMs = 0;
    const win = window as Window & {
      __fittrackSubjectLockPosePhase?: PosePhase;
      __fittrackSubjectLockSetPhase?: (phase: PosePhase) => void;
      __fittrackSubjectLockAdvanceClock?: (milliseconds: number) => void;
      __fittrackSubjectLockSyntheticFrame?: () => Array<{
        x: number;
        y: number;
        z: number;
        visibility: number;
      }>;
    };

    window.localStorage.setItem("fittrack_access_token", "subject-lock-access-token");
    window.localStorage.setItem("fittrack_refresh_token", "subject-lock-refresh-token");

    Date.now = () => fixedBaseMs + (nativeDateNow() - nativeStartMs) + offsetMs;
    win.__fittrackSubjectLockPosePhase = "valid";
    win.__fittrackSubjectLockSetPhase = (phase) => {
      win.__fittrackSubjectLockPosePhase = phase;
    };
    win.__fittrackSubjectLockAdvanceClock = (milliseconds) => {
      offsetMs += milliseconds;
    };

    win.__fittrackSubjectLockSyntheticFrame = () => {
      const point = (x: number, y: number, z = 0, visibility = 0.95) => ({
        visibility,
        x,
        y,
        z,
      });
      const points = Array.from({ length: 33 }, (_, index) =>
        point(0.5 + ((index % 3) - 1) * 0.01, 0.2 + (index % 8) * 0.04),
      );
      points[0] = point(0.5, 0.16);
      points[11] = point(0.4, 0.38);
      points[12] = point(0.6, 0.38);
      points[13] = point(0.34, 0.4);
      points[14] = point(0.66, 0.4);
      points[15] = point(0.3, 0.26);
      points[16] = point(0.7, 0.26);
      // Neutral hands are the fresh-body baseline. The rock phase below
      // raises both horn fingers to make the gesture explicit and continuous.
      points[17] = point(0.27, 0.245);
      points[18] = point(0.73, 0.245);
      points[19] = point(0.2, 0.245);
      points[20] = point(0.8, 0.245);
      points[21] = point(0.25, 0.22);
      points[22] = point(0.75, 0.22);
      points[23] = point(0.44, 0.64);
      points[24] = point(0.56, 0.64);
      points[25] = point(0.42, 0.8);
      points[26] = point(0.58, 0.8);
      points[27] = point(0.4, 0.94);
      points[28] = point(0.6, 0.94);
      points[31] = point(0.38, 0.98);
      points[32] = point(0.62, 0.98);

      const phase = win.__fittrackSubjectLockPosePhase ?? "valid";
      if (phase === "rock") {
        points[15] = point(0.3, 0.26);
        points[17] = point(0.3, 0.16);
        points[19] = point(0.2, 0.16);
        points[21] = point(0.25, 0.22);
      }
      if (phase === "jump") {
        points[13] = point(0.88, 0.12);
        points[15] = point(0.94, 0.08);
        points[17] = point(0.94, 0.02);
        points[19] = point(0.84, 0.02);
        points[21] = point(0.86, 0.12);
      }
      if (phase === "lost") {
        return points.map((current) => ({ ...current, visibility: 0 }));
      }
      if (phase === "broken") {
        points[11] = point(Number.NaN, 0.38);
      }
      return points;
    };
  }, FIXED_NOW);

  await page.route("**/vendor/mediapipe/tasks-vision/vision_bundle.mjs", async (route) => {
    await route.fulfill({
      body: `
        export const FilesetResolver = {
          forVisionTasks: async () => ({ synthetic: true }),
        };
        export const PoseLandmarker = {
          createFromOptions: async () => ({
            detectForVideo: () => ({
              landmarks: [globalThis.__fittrackSubjectLockSyntheticFrame?.() ?? []],
            }),
            close: () => undefined,
          }),
        };
      `,
      contentType: "text/javascript",
      status: 200,
    });
  });
  await page.route("**/vendor/mediapipe/tasks-vision/pose_landmarker_lite.task", async (route) => {
    await route.fulfill({ body: "synthetic-model", contentType: "application/octet-stream", status: 200 });
  });
  await page.route("**/vendor/mediapipe/tasks-vision/wasm/**", async (route) => {
    await route.fulfill({ body: "synthetic-wasm", contentType: "application/octet-stream", status: 200 });
  });

  await page.route("**/v1/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;
    const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
    if (method !== "GET") {
      state.mutations.push({ body, method, path });
    }

    if (method === "GET" && path === "/v1/users/me") {
      await fulfill(route, {
        email: "subject-lock-member@fittrack.test",
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
        phone_no: "+639171234567",
        profile: {
          first_name: "Subject",
          last_name: "Lock",
        },
        role: "USER",
        status: "active",
      });
      return;
    }
    if (method === "GET" && path === "/v1/users/deletion-request") {
      await fulfill(route, { status: null });
      return;
    }
    if (method === "GET" && path === "/v1/notifications/my") {
      await fulfill(route, []);
      return;
    }
    if (method === "GET" && path === "/v1/notifications/unread-count") {
      await fulfill(route, { count: 0 });
      return;
    }
    if (method === "GET" && path === "/v1/membership/my-subscription") {
      await fulfill(route, {
        id: "membership-subject-lock-fixture",
        plan: { name: "Fitness Access" },
        status: "active",
      });
      return;
    }
    if (method === "GET" && path === "/v1/fitness/exercises") {
      await fulfillPaginated(route, [exerciseRecord(state)], {
        page: 1,
        limit: 100,
        total: 1,
        total_pages: 1,
      });
      return;
    }
    if (method === "GET" && path === `/v1/fitness/exercises/${EXERCISE_ID}`) {
      await fulfill(route, exerciseRecord(state));
      return;
    }
    if (method === "GET" && path === "/v1/fitness/plans") {
      const summary = planRecord();
      const { schedule_days: _scheduleDays, ...withoutSchedule } = summary;
      await fulfillPaginated(route, [withoutSchedule], {
        page: 1,
        limit: 50,
        total: 1,
        total_pages: 1,
      });
      return;
    }
    if (method === "GET" && path === `/v1/fitness/plans/${PLAN_ID}`) {
      await fulfill(route, planRecord());
      return;
    }
    if (method === "GET" && path === "/v1/fitness/sessions") {
      await fulfillPaginated(route, [sessionSummary(state)], {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      });
      return;
    }
    if (method === "GET" && path === `/v1/fitness/sessions/${SESSION_ID}`) {
      await fulfill(route, sessionDetail(state));
      return;
    }
    if (method === "GET" && path === `/v1/fitness/plans/${PLAN_ID}/progression-suggestions`) {
      await fulfill(route, []);
      return;
    }

    if (method === "POST" && path === "/v1/fitness/sessions/start") {
      state.sessionStatus = "in_progress";
      await fulfill(route, sessionDetail(state));
      return;
    }
    if (method === "POST" && path === "/v1/pose/sessions/start") {
      state.poseStarted = true;
      await fulfill(route, { accepted_fps: 10, pose_session_id: POSE_SESSION_ID });
      return;
    }
    if (method === "POST" && path === `/v1/pose/sessions/${POSE_SESSION_ID}/analyze`) {
      state.analysisBodies.push(body);
      if (state.analysisDelayMs > 0) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, state.analysisDelayMs));
      }
      await fulfill(route, poseAnalysis(state, body));
      return;
    }
    if (method === "POST" && path === `/v1/pose/sessions/${POSE_SESSION_ID}/finalize`) {
      await fulfill(route, {
        analysis_summary: {},
        classification_confidence: "0.94",
        confidence_avg: "0.94",
        created_at: "2026-09-08T08:00:00.000Z",
        detected_exercise_name: EXERCISE_NAME,
        detected_profile_id: EXERCISE_ID,
        ended_at: "2026-09-08T08:05:00.000Z",
        exercise_hint: EXERCISE_NAME,
        exercise_log_id: null,
        id: POSE_SESSION_ID,
        rep_count_ai: Number(body.final_rep_count ?? 0),
        started_at: "2026-09-08T08:00:00.000Z",
        subject_lock_confidence: "0.94",
        updated_at: "2026-09-08T08:05:00.000Z",
        user_id: MEMBER_ID,
      });
      return;
    }
    if (method === "POST" && path === `/v1/fitness/sessions/${SESSION_ID}/sets`) {
      const setNumber = Number(body.set_number ?? 1);
      const log = {
        created_at: "2026-09-08T08:05:00.000Z",
        duration_seconds: body.duration_seconds ?? null,
        exercise_id: EXERCISE_ID,
        exercise_name: EXERCISE_NAME,
        id: `${SESSION_ID}-log-${setNumber}`,
        plan_exercise_id: PLAN_EXERCISE_ID,
        pose_session: state.poseStarted
          ? {
              confidence_avg: "0.94",
              ended_at: "2026-09-08T08:05:00.000Z",
              id: POSE_SESSION_ID,
              rep_count_ai: Number(body.reps_completed ?? 0),
              started_at: "2026-09-08T08:00:00.000Z",
            }
          : null,
        reps_ai_counted: body.reps_completed ?? 0,
        reps_completed: body.reps_completed ?? 0,
        session_id: SESSION_ID,
        set_number: setNumber,
        updated_at: "2026-09-08T08:05:00.000Z",
        user_id: MEMBER_ID,
        weight_kg: body.weight_kg ?? null,
      };
      state.logs.push(log);
      await fulfill(route, log);
      return;
    }
    if (method === "POST" && path === `/v1/fitness/sessions/${SESSION_ID}/complete`) {
      state.sessionStatus = "completed";
      await fulfill(route, sessionDetail(state));
      return;
    }

    state.unhandled.push(`${method} ${path}${url.search}`);
    await route.abort("blockedbyclient");
  });
}

async function setPosePhase(page: Page, phase: PosePhase) {
  await page.evaluate((nextPhase) => {
    const win = window as Window & {
      __fittrackSubjectLockSetPhase?: (value: PosePhase) => void;
    };
    win.__fittrackSubjectLockSetPhase?.(nextPhase);
  }, phase);
}

async function advanceSubjectLockClock(page: Page, milliseconds: number) {
  const direction = milliseconds < 0 ? -1 : 1;
  let remaining = Math.abs(milliseconds);
  while (remaining > 0) {
    const step = Math.min(160, remaining) * direction;
    await page.evaluate((duration) => {
      const win = window as Window & {
        __fittrackSubjectLockAdvanceClock?: (value: number) => void;
      };
      win.__fittrackSubjectLockAdvanceClock?.(duration);
    }, step);
    // Keep each synthetic timestamp gap below the 350 ms freshness boundary
    // so a clock advance models continuing observations instead of a gap.
    await page.waitForTimeout(120);
    remaining -= Math.abs(step);
  }
}

async function openPlannedCamera(page: Page, state?: FixtureState) {
  await page.goto(`${MOBILE_BASE_URL}/workout`, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/workout(?:\?|$)/);
  await expect(page.getByText("Today's workout", { exact: true })).toBeVisible({ timeout: 20_000 });
  const cameraEntry = page.getByRole("button", { name: "Track This Set With Camera", exact: true });
  try {
    await expect(cameraEntry).toBeVisible({ timeout: 20_000 });
  } catch {
    throw new Error(
      `Planned camera entry was not rendered. requests=${state?.observedRequests.join(" | ") ?? "none"}; unhandled=${state?.unhandled.join(" | ") ?? "none"}`,
    );
  }
  await cameraEntry.click();
  await expect(page.getByText("Live Tracking", { exact: true })).toBeVisible();
  await stabilizeVisualPage(page);

  const initCamera = page.getByRole("button", {
    name: /^(?:Allow Camera Access|Start Camera)$/,
    exact: true,
  });
  if (await initCamera.count()) {
    await initCamera.first().click();
  }
  await expect(page.getByRole("button", { name: "Start Set", exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Start Set", exact: true }).click();
  try {
    await expect(page.getByRole("button", { name: /^(?:Pause|Pause recording)$/ }).first()).toBeVisible({ timeout: 15_000 });
  } catch {
    const visibleText = await page.locator("body").innerText().catch(() => "");
    const videoState = await page.locator("video").evaluateAll((videos) =>
      videos.map((video) => ({
        readyState: video.readyState,
        videoHeight: video.videoHeight,
        videoWidth: video.videoWidth,
        srcObject: Boolean(video.srcObject),
      })),
    ).catch(() => []);
    throw new Error(
      `Planned camera did not enter recording. requests=${state?.observedRequests.join(" | ") ?? "none"}; mutations=${state?.mutations.map(({ method, path }) => `${method} ${path}`).join(" | ") ?? "none"}; unhandled=${state?.unhandled.join(" | ") ?? "none"}; console=${state?.consoleErrors.join(" | ") ?? "none"}; video=${JSON.stringify(videoState)}; body=${visibleText.slice(0, 1600)}`,
    );
  }
}

async function openFreeCamera(page: Page, state?: FixtureState) {
  await page.goto(`${MOBILE_BASE_URL}/workout`, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/workout(?:\?|$)/);
  await expect(page.getByText("Today's workout", { exact: true })).toBeVisible({ timeout: 20_000 });
  const freeEntry = page.getByRole("button", {
    name: /^(?:Start Free Workout|Free Workout|Use Camera Rep Counter \(Optional\))$/i,
  }).first();
  if (!(await freeEntry.count())) return false;

  await freeEntry.click();
  await expect(page.getByText("Live Tracking", { exact: true })).toBeVisible();
  await stabilizeVisualPage(page);
  const initCamera = page.getByRole("button", {
    name: /^(?:Allow Camera Access|Start Camera)$/,
    exact: true,
  });
  if (await initCamera.count()) await initCamera.first().click();
  const startRecording = page.getByRole("button", {
    name: /^(?:Start recording|Start Recording)$/,
    exact: true,
  });
  try {
    await expect(startRecording).toBeVisible({ timeout: 15_000 });
    await startRecording.click();
    await expect(page.getByRole("button", { name: /^(?:Pause recording|Pause)$/ }).first()).toBeVisible({ timeout: 15_000 });
  } catch {
    const visibleText = await page.locator("body").innerText().catch(() => "");
    throw new Error(
      `Free camera did not enter recording. requests=${state?.observedRequests.join(" | ") ?? "none"}; mutations=${state?.mutations.map(({ method, path }) => `${method} ${path}`).join(" | ") ?? "none"}; unhandled=${state?.unhandled.join(" | ") ?? "none"}; body=${visibleText.slice(0, 1600)}`,
    );
  }
  await expect(page.getByRole("button", { name: /^Lock on me(?:\.|$)/ })).toHaveCount(1);
  return true;
}

async function captureEvidence(page: Page, testInfo: TestInfo, name: string) {
  const audit = await auditConventionalLayout(page);
  const evidenceRoot = resolve(process.cwd(), ".artifacts", "playwright", "subject-lock");
  await mkdir(evidenceRoot, { recursive: true });
  const safeName = `${testInfo.project.name}-${testInfo.testId}-${name}`.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const auditPath = resolve(evidenceRoot, `${safeName}.layout.json`);
  await writeFile(auditPath, JSON.stringify(audit, null, 2));
  await testInfo.attach(`${name}-layout.json`, {
    body: JSON.stringify(audit, null, 2),
    contentType: "application/json",
  });
  await page.screenshot({ path: resolve(evidenceRoot, `${safeName}.png`), fullPage: true });
  return audit;
}

async function assertLayout(page: Page, testInfo: TestInfo, name: string) {
  const audit = await captureEvidence(page, testInfo, name);
  expect(audit.horizontalOverflow, "horizontal overflow").toBe(false);
  expect(audit.squishedText, "squished text").toEqual([]);
  expect(audit.clipping, "clipped text or controls").toEqual([]);
  expect(audit.overlaps, "overlapping interactive controls").toEqual([]);
  expect(audit.nestedScrollbars, "nested scrollbars").toEqual([]);
}

async function assertSubjectLockPanelLayout(
  page: Page,
  options: { lockDisabled?: boolean } = {},
) {
  const panel = page.getByTestId("workout-subject-lock-controls");
  await expect(panel).toHaveCount(1);
  await expect(panel).toBeVisible();

  const action = panel.getByRole("button", {
    name: /^(?:Lock on me|Unlock target)(?:\.|$)/,
    exact: true,
  });
  await expect(action).toHaveCount(1);
  await expect(page.getByRole("button", { name: /^(?:Lock on me|Unlock target)(?:\.|$)/ })).toHaveCount(1);
  if (options.lockDisabled === true) {
    await expect(action).toBeDisabled({ timeout: 2_000 });
  } else if (options.lockDisabled === false) {
    await expect(action).toBeEnabled({ timeout: 2_000 });
  }

  const facing = page.getByRole("button", { name: /^(?:Front|Back)$/ }).first();
  await expect(facing).toBeVisible();
  const preview = page.getByTestId("rep-gates-overlay");
  await expect(preview).toBeVisible();
  const plannedControls = page.getByRole("button", { name: "Pause", exact: true }).last();
  await expect(plannedControls).toBeVisible();

  const [panelBox, facingBox, previewBox, controlsBox] = await Promise.all([
    panel.boundingBox(),
    facing.boundingBox(),
    preview.boundingBox(),
    plannedControls.boundingBox(),
  ]);
  expect(panelBox, "subject-lock panel bounds").not.toBeNull();
  expect(facingBox, "camera-facing control bounds").not.toBeNull();
  expect(previewBox, "preview bounds").not.toBeNull();
  expect(controlsBox, "planned set controls bounds").not.toBeNull();
  if (!panelBox || !facingBox || !previewBox || !controlsBox) return;

  const overlapWidth = Math.max(
    0,
    Math.min(panelBox.x + panelBox.width, facingBox.x + facingBox.width) -
      Math.max(panelBox.x, facingBox.x),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(panelBox.y + panelBox.height, facingBox.y + facingBox.height) -
      Math.max(panelBox.y, facingBox.y),
  );
  expect(overlapWidth * overlapHeight, "subject-lock panel overlaps camera-facing control").toBeLessThanOrEqual(1);
  expect(panelBox.y, "subject-lock panel should follow the preview").toBeGreaterThanOrEqual(
    previewBox.y + previewBox.height - 1,
  );
  expect(panelBox.y + panelBox.height, "subject-lock panel overlaps planned set controls").toBeLessThanOrEqual(
    controlsBox.y + 1,
  );
}

async function assertGestureProgressVisible(page: Page) {
  const progress = page.getByRole("progressbar", {
    name: /Subject lock gesture hold/i,
  });
  await expect(progress).toHaveCount(1);
  await expect(progress).toBeVisible();
  await expect(progress).toHaveAttribute("aria-valuemin", "0");
  await expect(progress).toHaveAttribute("aria-valuemax", "100");
  await expect
    .poll(async () => Number(await progress.getAttribute("aria-valuenow") ?? -1))
    .toBeGreaterThan(0);
  await expect(progress).toHaveAttribute("aria-valuenow", /^(?:[1-9]|[1-9]\d|100)$/);
}

async function assertNoMutationOutsideFixture(state: FixtureState) {
  const fixtureMutationPaths = new Set([
    "/v1/fitness/sessions/start",
    "/v1/pose/sessions/start",
    `/v1/pose/sessions/${POSE_SESSION_ID}/analyze`,
    `/v1/pose/sessions/${POSE_SESSION_ID}/finalize`,
    `/v1/fitness/sessions/${SESSION_ID}/sets`,
    `/v1/fitness/sessions/${SESSION_ID}/complete`,
  ]);
  expect(state.unhandled, "unexpected API requests (including writes)").toEqual([]);
  expect(
    state.mutations.every(({ path }) => fixtureMutationPaths.has(path)),
    "unexpected API mutation outside the in-memory fixture",
  ).toBe(true);
}

async function assertSafeHandProfileSurface(page: Page, state: FixtureState) {
  expect(state.pageErrors, `${state.handProfileVariant} page errors`).toEqual([]);
  await expect(page.locator("body")).not.toContainText(/holdMs/i);
}

async function exerciseManualLockWithBodyLoss(page: Page) {
  const lock = page.getByRole("button", { name: /^Lock on me(?:\.|$)/ });
  const unlock = page.getByRole("button", { name: /^Unlock target(?:\.|$)/ });
  await expect(lock).toBeEnabled();
  await lock.click();
  await expect(unlock).toHaveCount(1);

  await setPosePhase(page, "lost");
  await advanceSubjectLockClock(page, 1_200);
  await expect(lock).toHaveCount(1);
  await expect(lock).toBeDisabled();

  await setPosePhase(page, "valid");
  await advanceSubjectLockClock(page, 240);
  await expect(lock).toBeEnabled();
}

for (const viewport of mobileViewports) {
  test.describe(`subject lock route · ${viewport}`, () => {
    test("planned mode starts before lock, waits for lock, and unlock pauses counting", async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== viewport, `This case is scoped to ${viewport}.`);
      const state = newFixtureState();
      await installWorkoutFixtures(page, state);
      await openPlannedCamera(page, state);
      await assertSubjectLockPanelLayout(page, { lockDisabled: false });

      const lock = page.getByRole("button", { name: /^Lock on me(?:\.|$)/ });
      const unlock = page.getByRole("button", { name: /^Unlock target(?:\.|$)/ });
      await expect(unlock).toHaveCount(0);

      const status = page.locator('[aria-label^="Camera "]').first();
      await expect(status).toHaveAttribute("aria-label", /0 of 8 reps/);
      await advanceSubjectLockClock(page, 700);
      await expect(status).toHaveAttribute("aria-label", /0 of 8 reps/);

      await lock.click();
      await expect(unlock).toHaveCount(1);
      await expect(lock).toHaveCount(0);
      const ariaLabels = await page.locator("[aria-label]").evaluateAll((elements) =>
        elements
          .map((element) => element.getAttribute("aria-label") ?? "")
          .filter((label) => /subject lock/i.test(label)),
      );
      expect(ariaLabels.some((label) => /active/i.test(label))).toBe(true);
      expect(ariaLabels.some((label) => /automatic subject lock is active/i.test(label))).toBe(false);
      await advanceSubjectLockClock(page, 500);
      await expect(status).toHaveAttribute("aria-label", /0 of 8 reps/);

      await unlock.click();
      await expect(lock).toHaveCount(1);
      await expect(unlock).toHaveCount(0);
      await expect(status).toHaveAttribute("aria-label", /0 of 8 reps/);
      await assertSubjectLockPanelLayout(page, { lockDisabled: false });
      await assertNoMutationOutsideFixture(state);
      await assertLayout(page, testInfo, "planned-unlocked");
    });

    test("rock-sign hold locks after the configured duration and a broken hold resets", async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== viewport, `This case is scoped to ${viewport}.`);
      const state = newFixtureState({ gestureHoldMs: 3000 });
      await installWorkoutFixtures(page, state);
      await openPlannedCamera(page, state);

      const lock = page.getByRole("button", { name: /^Lock on me(?:\.|$)/ });
      const unlock = page.getByRole("button", { name: /^Unlock target(?:\.|$)/ });
      await setPosePhase(page, "rock");
      await advanceSubjectLockClock(page, 1100);
      await assertGestureProgressVisible(page);
      await expect(unlock).toHaveCount(0);
      await setPosePhase(page, "valid");
      await advanceSubjectLockClock(page, 180);
      await expect(unlock).toHaveCount(0);
      await setPosePhase(page, "rock");
      await advanceSubjectLockClock(page, 3050);
      await expect(unlock).toHaveCount(1);
      await expect(lock).toHaveCount(0);
      await assertNoMutationOutsideFixture(state);
      await assertLayout(page, testInfo, "gesture-locked");
    });

    test("loss grace preserves the lock briefly and releases after the grace window", async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== viewport, `This case is scoped to ${viewport}.`);
      const state = newFixtureState();
      await installWorkoutFixtures(page, state);
      await openPlannedCamera(page, state);

      await page.getByRole("button", { name: /^Lock on me(?:\.|$)/ }).click();
      const unlock = page.getByRole("button", { name: /^Unlock target(?:\.|$)/ });
      const lock = page.getByRole("button", { name: /^Lock on me(?:\.|$)/ });
      await expect(unlock).toHaveCount(1);
      await setPosePhase(page, "lost");
      await advanceSubjectLockClock(page, 250);
      await expect(unlock).toHaveCount(1);
      await advanceSubjectLockClock(page, 850);
      await expect(lock).toHaveCount(1);
      await expect(unlock).toHaveCount(0);
      await assertSubjectLockPanelLayout(page, { lockDisabled: true });
      await assertNoMutationOutsideFixture(state);
      await assertLayout(page, testInfo, "loss-released");
    });

    test("retained lock unlocks while body is absent and gesture requires release before rearm", async ({ page }, testInfo) => {
      test.skip(
        testInfo.project.name !== viewport || viewport !== "mobile-390x844",
        "Run retained-unlock rearm once at the canonical mobile width.",
      );
      const state = newFixtureState();
      await installWorkoutFixtures(page, state);
      await openPlannedCamera(page, state);

      await assertSubjectLockPanelLayout(page, { lockDisabled: false });
      const lock = page.getByRole("button", { name: /^Lock on me(?:\.|$)/ });
      const unlock = page.getByRole("button", { name: /^Unlock target(?:\.|$)/ });
      await lock.click();
      await expect(unlock).toHaveCount(1);

      // Keep the invalid observation inside the one-second loss grace window.
      // The retained state must still expose Unlock and must not route the
      // action through manual lock when the body is absent.
      await setPosePhase(page, "lost");
      await advanceSubjectLockClock(page, 250);
      await expect(unlock).toHaveCount(1);
      await expect(page.getByTestId("workout-subject-lock-controls")).toContainText(
        /subject|track|gesture|frame/i,
      );
      await unlock.click();
      await expect(unlock).toHaveCount(0);
      await expect(lock).toHaveCount(1);
      await expect(lock).toBeDisabled();
      await assertSubjectLockPanelLayout(page, { lockDisabled: true });
      await expect(page.locator('[aria-label^="Camera "]').first()).toHaveAttribute("aria-label", /0 of 8 reps/);

      // A held rock sign cannot immediately rearm after explicit release.
      await setPosePhase(page, "rock");
      await advanceSubjectLockClock(page, 3200);
      await expect(unlock).toHaveCount(0);
      await expect(lock).toHaveCount(1);
      await expect(page.getByTestId("workout-subject-lock-controls")).toContainText(
        /Release the rock sign before holding again/i,
      );

      // A visible neutral pose releases the latch; the next fresh hold may
      // acquire the subject lock.
      await setPosePhase(page, "valid");
      await advanceSubjectLockClock(page, 240);
      await expect(lock).toBeEnabled();
      await setPosePhase(page, "rock");
      await advanceSubjectLockClock(page, 3050);
      await expect(unlock).toHaveCount(1);
      await expect(lock).toHaveCount(0);
      await assertNoMutationOutsideFixture(state);
      await assertLayout(page, testInfo, "retained-unlock-rearm");
    });

    test("late analysis cannot restore an unlocked subject while fresh frames continue", async ({ page }, testInfo) => {
      test.skip(
        testInfo.project.name !== viewport || viewport !== "mobile-390x844",
        "Run delayed analysis once at the canonical mobile width.",
      );
      const state = newFixtureState({ analysisDelayMs: 1400 });
      await installWorkoutFixtures(page, state);
      const opened = await openFreeCamera(page, state);
      if (!opened) {
        testInfo.annotations.push({
          type: "free-mode",
          description: "Delayed server-analysis journey unavailable because the current /workout route exposes only planned camera entry.",
        });
        await assertNoMutationOutsideFixture(state);
        return;
      }

      const lock = page.getByRole("button", { name: /^Lock on me(?:\.|$)/ });
      const unlock = page.getByRole("button", { name: /^Unlock target(?:\.|$)/ });
      await lock.click();
      await expect(unlock).toHaveCount(1);

      // The route records a request before delaying its response. Valid
      // frames stay enabled while this response is in flight.
      await expect.poll(() => state.analysisBodies.length, { timeout: 15_000 }).toBeGreaterThan(0);
      await unlock.click();
      await expect(lock).toHaveCount(1);
      await page.waitForTimeout(1_800);

      await expect(lock).toHaveCount(1);
      await expect(unlock).toHaveCount(0);
      await expect(page.locator('[aria-label^="Camera "]').first()).toHaveAttribute("aria-label", /0 of 8 reps/);
      await assertNoMutationOutsideFixture(state);
      await assertLayout(page, testInfo, "late-analysis-unlocked");
    });
  });
}

for (const profileVariant of ["nested-null", "snake-case"] as const) {
  test(`partial ${profileVariant} hand profile keeps manual subject lock safe`, async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-390x844",
      "Run partial hand-profile normalization at the canonical mobile width.",
    );
    const state = newFixtureState({ handProfileVariant: profileVariant });
    await installWorkoutFixtures(page, state);
    await openPlannedCamera(page, state);
    await assertSafeHandProfileSurface(page, state);
    await exerciseManualLockWithBodyLoss(page);
    await assertSafeHandProfileSurface(page, state);
    await assertNoMutationOutsideFixture(state);
  });
}

test("grip-only hand profile retains the default gesture hold timing", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390x844", "Run default hold timing at the canonical mobile width.");
  const state = newFixtureState({ handProfileVariant: "grip-only" });
  await installWorkoutFixtures(page, state);
  await openPlannedCamera(page, state);
  await assertSafeHandProfileSurface(page, state);

  const lock = page.getByRole("button", { name: /^Lock on me(?:\.|$)/ });
  const unlock = page.getByRole("button", { name: /^Unlock target(?:\.|$)/ });
  await setPosePhase(page, "rock");
  await advanceSubjectLockClock(page, 1_150);
  await assertGestureProgressVisible(page);
  await expect(unlock).toHaveCount(0);
  await advanceSubjectLockClock(page, 2_050);
  await expect(unlock).toHaveCount(1);
  await expect(lock).toHaveCount(0);
  await assertSafeHandProfileSurface(page, state);
  await assertNoMutationOutsideFixture(state);
});

test("partial disabled hand profile hides gesture guidance while manual lock stays usable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390x844", "Run disabled partial profile behavior at the canonical mobile width.");
  const state = newFixtureState({
    gestureEnabled: false,
    gestureHoldMs: 1_400,
    handProfileVariant: "partial-disabled",
  });
  await installWorkoutFixtures(page, state);
  await openPlannedCamera(page, state);
  await assertSafeHandProfileSurface(page, state);
  await expect(page.getByText(/rock-and-roll sign|Gesture hold/i)).toHaveCount(0);
  await exerciseManualLockWithBodyLoss(page);
  await assertSafeHandProfileSurface(page, state);
  await assertNoMutationOutsideFixture(state);
});

test("configured hand profile hold timing is used for gesture locking", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390x844", "Run configured hold timing at the canonical mobile width.");
  const state = newFixtureState({ gestureHoldMs: 1_000 });
  await installWorkoutFixtures(page, state);
  await openPlannedCamera(page, state);
  await assertSafeHandProfileSurface(page, state);

  const lock = page.getByRole("button", { name: /^Lock on me(?:\.|$)/ });
  const unlock = page.getByRole("button", { name: /^Unlock target(?:\.|$)/ });
  await setPosePhase(page, "rock");
  await advanceSubjectLockClock(page, 1_150);
  await expect(unlock).toHaveCount(1);
  await expect(lock).toHaveCount(0);
  await assertSafeHandProfileSurface(page, state);
  await assertNoMutationOutsideFixture(state);
});

test("disabled gesture hides gesture guidance while manual lock remains usable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390x844", "Run disabled gesture behavior once at the canonical mobile width.");
  const state = newFixtureState({ gestureEnabled: false });
  await installWorkoutFixtures(page, state);
  await openPlannedCamera(page, state);

  await expect(page.getByText(/rock-and-roll sign|Gesture hold/i)).toHaveCount(0);
  const lock = page.getByRole("button", { name: /^Lock on me(?:\.|$)/ });
  await expect(lock).toHaveCount(1);
  await lock.click();
  await expect(page.getByRole("button", { name: /^Unlock target(?:\.|$)/ })).toHaveCount(1);
  await assertNoMutationOutsideFixture(state);
  await assertLayout(page, testInfo, "gesture-disabled-manual-lock");
});

test("free mode uses the same subject lock control when the route exposes a free entry", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390x844", "Run free mode once at the canonical mobile width.");
  const state = newFixtureState();
  await installWorkoutFixtures(page, state);
  const opened = await openFreeCamera(page, state);
  if (!opened) {
    testInfo.annotations.push({
      type: "free-mode",
      description: "The current production route exposes only planned camera entry; core lane must add/confirm the free entry before this journey can run.",
    });
    await assertNoMutationOutsideFixture(state);
    return;
  }
  const lock = page.getByRole("button", { name: /^Lock on me(?:\.|$)/ });
  await expect(lock).toHaveCount(1);
  await lock.click();
  await expect(page.getByRole("button", { name: /^Unlock target(?:\.|$)/ })).toHaveCount(1);
  await assertNoMutationOutsideFixture(state);
  await assertLayout(page, testInfo, "free-mode-locked");
});

test("responsive small viewport camera controls remain reachable", async ({ page }, testInfo) => {
  const state = newFixtureState();
  await installWorkoutFixtures(page, state);
  await openPlannedCamera(page, state);
  await stabilizeVisualPage(page);

  const panel = page.getByTestId("workout-subject-lock-controls");
  const lock = page.getByRole("button", { name: /^Lock on me(?:\.|$)/ });
  const unlock = page.getByRole("button", { name: /^Unlock target(?:\.|$)/ });
  await assertSubjectLockPanelLayout(page, { lockDisabled: false });

  const scrollOwner = await page.evaluate(() => {
    const candidates = [
      document.scrollingElement,
      ...Array.from(document.querySelectorAll<HTMLElement>("*")),
    ].filter((node): node is HTMLElement => Boolean(node));
    const owner = candidates
      .filter((node) => {
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return (
          ["auto", "scroll", "overlay"].includes(style.overflowY) &&
          node.scrollHeight > node.clientHeight + 4 &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.top < window.innerHeight &&
          rect.left >= -1 &&
          rect.right <= window.innerWidth + 1
        );
      })
      .sort(
        (left, right) =>
          right.scrollHeight - right.clientHeight -
          (left.scrollHeight - left.clientHeight),
      )[0];
    if (owner) owner.setAttribute("data-camera-responsive-scroll-owner", "true");
    const rect = owner?.getBoundingClientRect();
    const style = owner ? window.getComputedStyle(owner) : null;
    return {
      before: owner?.scrollTop ?? 0,
      bounded: Boolean(
        rect &&
          rect.left >= -1 &&
          rect.right <= window.innerWidth + 1 &&
          rect.top < window.innerHeight &&
          rect.bottom > 0,
      ),
      clientHeight: owner?.clientHeight ?? 0,
      overflowY: style?.overflowY ?? null,
      scrollHeight: owner?.scrollHeight ?? 0,
      visible: Boolean(rect && rect.width > 0 && rect.height > 0),
    };
  });
  if (scrollOwner.scrollHeight > scrollOwner.clientHeight + 4) {
    await page.evaluate(() => {
      const owner = document.querySelector<HTMLElement>(
        '[data-camera-responsive-scroll-owner="true"]',
      );
      if (owner) owner.scrollTop = owner.scrollHeight - owner.clientHeight;
    });
    await expect
      .poll(() =>
        page.locator('[data-camera-responsive-scroll-owner="true"]').evaluate(
          (element) => (element as HTMLElement).scrollTop,
        ),
      )
      .toBeGreaterThan(scrollOwner.before + 1);
  }
  expect(scrollOwner.visible, "camera scroll owner visible").toBe(true);
  expect(scrollOwner.bounded, "camera scroll owner bounded").toBe(true);
  expect(["auto", "scroll", "overlay"], "camera scroll owner overflow").toContain(
    scrollOwner.overflowY,
  );

  const ensureInViewport = async (locator: Locator, label: string) => {
    await locator.scrollIntoViewIfNeeded();
    await expect
      .poll(async () => {
        const box = await locator.boundingBox();
        const viewport = page.viewportSize();
        return Boolean(
          box &&
            viewport &&
            box.x >= 0 &&
            box.x + box.width <= viewport.width &&
            box.y >= 0 &&
            box.y + box.height <= viewport.height,
        );
      }, `${label} viewport reachability`)
      .toBe(true);
  };

  const strictTapAtPaddingEdge = async (locator: Locator, label: string) => {
    let latest: unknown;
    await expect
      .poll(async () => {
        latest = await locator.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const points = [
            [rect.left + rect.width / 2, rect.top + rect.height / 2],
            [rect.left + Math.min(3, rect.width / 2), rect.top + rect.height / 2],
            [rect.right - Math.min(3, rect.width / 2), rect.top + rect.height / 2],
            [rect.left + rect.width / 2, rect.top + Math.min(3, rect.height / 2)],
            [rect.left + rect.width / 2, rect.bottom - Math.min(3, rect.height / 2)],
          ];
          return {
            hits: points.map(([x, y]) => {
              const top = document.elementFromPoint(x, y);
              return Boolean(top && (top === element || element.contains(top)));
            }),
            rect: {
              bottom: Math.round(rect.bottom),
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              top: Math.round(rect.top),
            },
          };
        });
        return latest;
      }, `${label} settled hit test`).toMatchObject({
        hits: [true, true, true, true, true],
      });
    const box = await locator.boundingBox();
    expect(box, `${label} bounds`).not.toBeNull();
    if (!box) return;
    await page.mouse.click(box.x + Math.min(3, box.width / 2), box.y + box.height / 2);
  };

  await expect(panel, "subject-lock panel visible").toBeVisible();
  await ensureInViewport(lock, "Lock on me control");
  await strictTapAtPaddingEdge(lock, "Lock on me control");
  await expect(unlock).toHaveCount(1);
  await ensureInViewport(unlock, "Unlock target control");
  await strictTapAtPaddingEdge(unlock, "Unlock target control");
  await expect(lock).toHaveCount(1);
  await assertSubjectLockPanelLayout(page, { lockDisabled: false });
  await assertNoMutationOutsideFixture(state);
  await assertLayout(page, testInfo, "responsive-small-viewport-camera-controls");
});
