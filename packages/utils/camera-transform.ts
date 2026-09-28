export type CameraRotation = 0 | 90 | 180 | 270;

/** Vision Camera's frame orientation values. Kept local so shared utilities
 * do not take a native runtime dependency. */
export type CameraFrameOrientation =
  | "portrait"
  | "portrait-upside-down"
  | "landscape-left"
  | "landscape-right";

/**
 * Converts the orientation carried by a camera frame into the clockwise
 * rotation used by the normalized cover transform. The adapter must pass the
 * frame's real orientation; callers must not infer it from aspect ratio.
 */
export function cameraRotationFromOrientation(
  orientation: CameraFrameOrientation,
): CameraRotation {
  "worklet";
  switch (orientation) {
    case "landscape-right":
      return 90;
    case "portrait-upside-down":
      return 180;
    case "landscape-left":
      return 270;
    case "portrait":
    default:
      return 0;
  }
}

export type CameraTransformOptions = {
  frameHeight: number;
  frameWidth: number;
  mirrorX?: boolean;
  rotation?: CameraRotation;
  viewportHeight: number;
  viewportWidth: number;
};

export type NormalizedCameraPoint = {
  x: number;
  y: number;
};

export type NormalizedCameraRect = NormalizedCameraPoint & {
  height: number;
  width: number;
};

function clampUnit(value: number) {
  return Math.max(0, Math.min(1, value));
}

function rotateNormalizedPoint(
  point: NormalizedCameraPoint,
  rotation: CameraRotation,
): NormalizedCameraPoint {
  switch (rotation) {
    case 90:
      return { x: 1 - point.y, y: point.x };
    case 180:
      return { x: 1 - point.x, y: 1 - point.y };
    case 270:
      return { x: point.y, y: 1 - point.x };
    default:
      return point;
  }
}

/**
 * Maps normalized camera coordinates into a cover-cropped preview. The same
 * transform is used for skeleton points and equipment rectangles so both
 * overlays stay aligned when the camera is mirrored or rotated.
 */
export function createCoverCropTransform(options: CameraTransformOptions) {
  const frameWidth = Math.max(1, options.frameWidth);
  const frameHeight = Math.max(1, options.frameHeight);
  const viewportWidth = Math.max(1, options.viewportWidth);
  const viewportHeight = Math.max(1, options.viewportHeight);
  const rotation = options.rotation ?? 0;
  const orientedWidth = rotation === 90 || rotation === 270 ? frameHeight : frameWidth;
  const orientedHeight = rotation === 90 || rotation === 270 ? frameWidth : frameHeight;
  const scale = Math.max(
    viewportWidth / orientedWidth,
    viewportHeight / orientedHeight,
  );
  const renderedWidth = orientedWidth * scale;
  const renderedHeight = orientedHeight * scale;
  const cropX = (renderedWidth - viewportWidth) / 2;
  const cropY = (renderedHeight - viewportHeight) / 2;

  const point = (input: NormalizedCameraPoint): NormalizedCameraPoint => {
    const rotated = rotateNormalizedPoint(input, rotation);
    const renderedX = rotated.x * renderedWidth - cropX;
    const renderedY = rotated.y * renderedHeight - cropY;
    const transformed = {
      x: renderedX / viewportWidth,
      y: renderedY / viewportHeight,
    };
    return {
      x: clampUnit(options.mirrorX ? 1 - transformed.x : transformed.x),
      y: clampUnit(transformed.y),
    };
  };

  const rect = (input: NormalizedCameraRect): NormalizedCameraRect => {
    const corners = [
      point({ x: input.x, y: input.y }),
      point({ x: input.x + input.width, y: input.y }),
      point({ x: input.x, y: input.y + input.height }),
      point({ x: input.x + input.width, y: input.y + input.height }),
    ];
    const minX = Math.min(...corners.map((corner) => corner.x));
    const maxX = Math.max(...corners.map((corner) => corner.x));
    const minY = Math.min(...corners.map((corner) => corner.y));
    const maxY = Math.max(...corners.map((corner) => corner.y));
    return {
      x: minX,
      y: minY,
      width: Math.max(0, maxX - minX),
      height: Math.max(0, maxY - minY),
    };
  };

  return { point, rect };
}
