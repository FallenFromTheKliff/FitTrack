export type ExerciseCameraErrorKind =
  | "permission"
  | "no-device"
  | "busy"
  | "unsupported"
  | "unavailable"
  | "model";

export type ExerciseCameraErrorInfo = {
  kind: ExerciseCameraErrorKind;
  message: string;
};

function readErrorShape(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: "", name: "" };
  }
  const candidate = error as { message?: unknown; name?: unknown };
  return {
    message: typeof candidate.message === "string" ? candidate.message : "",
    name: typeof candidate.name === "string" ? candidate.name : "",
  };
}

export function classifyExerciseCameraError(
  error: unknown,
): ExerciseCameraErrorInfo {
  const { message, name } = readErrorShape(error);
  const text = `${name} ${message}`.toLowerCase();

  if (
    name === "NotAllowedError" ||
    name === "SecurityError" ||
    /permission|denied|policy|blocked/.test(text)
  ) {
    return {
      kind: "permission",
      message:
        "Camera permission is blocked. Allow camera access for this site, then retry.",
    };
  }

  if (
    name === "NotFoundError" ||
    name === "DevicesNotFoundError" ||
    name === "OverconstrainedError" ||
    /no camera|camera device|device not found|video input/.test(text)
  ) {
    return {
      kind: "no-device",
      message:
        "No camera device was found. Connect a camera or continue without validation.",
    };
  }

  if (
    name === "NotReadableError" ||
    name === "TrackStartError" ||
    /camera.*busy|device.*busy|already in use|could not start video/.test(text)
  ) {
    return {
      kind: "busy",
      message:
        "The camera is busy or unreadable. Close other camera apps, then retry.",
    };
  }

  if (
    name === "TypeError" ||
    /secure context|insecure origin|getusermedia|media devices|unsupported/.test(
      text,
    )
  ) {
    return {
      kind: "unsupported",
      message:
        "Camera access requires a secure browser origin with getUserMedia support.",
    };
  }

  return {
    kind: "unavailable",
    message:
      "The camera could not be started. Retry or continue without validation.",
  };
}

export function exerciseCameraModelError(): ExerciseCameraErrorInfo {
  return {
    kind: "model",
    message:
      "Camera is live, but the on-device pose model is unavailable. Retry the model when ready.",
  };
}

export function formatExerciseCameraErrorLabel(
  kind: ExerciseCameraErrorKind | null,
) {
  switch (kind) {
    case "permission":
      return "Camera permission blocked";
    case "no-device":
      return "No camera device";
    case "busy":
      return "Camera busy";
    case "unsupported":
      return "Camera unsupported";
    case "model":
      return "Pose model unavailable";
    default:
      return "Camera unavailable";
  }
}
