#import "FitTrackMultiPoseSessionRegistry.h"

#import <MediaPipeTasksVision/MediaPipeTasksVision.h>

#import <math.h>

NSString *const FitTrackMultiPoseErrorDomain = @"FitTrackMultiPose";

static const NSUInteger kFitTrackMultiPoseMaximumSessions = 3;

@interface FitTrackMultiPoseSession : NSObject
@property(nonatomic, strong, nullable) MPPPoseLandmarker *landmarker;
@property(nonatomic, strong) NSLock *lock;
@property(nonatomic, assign) BOOL closed;
@property(nonatomic, assign) NSInteger lastTimestampMs;
- (instancetype)initWithLandmarker:(MPPPoseLandmarker *)landmarker;
@end

@implementation FitTrackMultiPoseSession

- (instancetype)initWithLandmarker:(MPPPoseLandmarker *)landmarker {
  self = [super init];
  if (self) {
    _landmarker = landmarker;
    _lock = [[NSLock alloc] init];
    _lastTimestampMs = -1;
  }
  return self;
}

@end

static NSLock *FitTrackMultiPoseRegistryLock(void) {
  static NSLock *lock;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    lock = [[NSLock alloc] init];
  });
  return lock;
}

static NSMutableDictionary<NSString *, FitTrackMultiPoseSession *> *
FitTrackMultiPoseSessions(void) {
  static NSMutableDictionary<NSString *, FitTrackMultiPoseSession *> *sessions;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    sessions = [[NSMutableDictionary alloc] init];
  });
  return sessions;
}

static NSError *FitTrackMultiPoseError(NSString *code, NSString *message) {
  return [NSError errorWithDomain:FitTrackMultiPoseErrorDomain
                              code:1
                          userInfo:@{
                            NSLocalizedDescriptionKey : message,
                            @"code" : code,
                          }];
}

static NSDictionary<NSString *, id> *FitTrackMultiPoseErrorResult(NSString *code,
                                                                   NSString *message) {
  return @{
    @"status" : @"error",
    @"code" : code,
    @"message" : message,
  };
}

static NSDictionary<NSString *, id> *FitTrackMultiPoseSuccessResult(
    NSArray<NSDictionary<NSString *, id> *> *candidates) {
  return @{
    @"status" : @"ok",
    @"candidates" : candidates ?: @[],
  };
}

static NSString *FitTrackMultiPoseModelPath(void) {
  NSArray<NSBundle *> *bundles = @[
    [NSBundle bundleForClass:[FitTrackMultiPoseSessionRegistry class]],
    [NSBundle mainBundle],
  ];
  for (NSBundle *bundle in bundles) {
    NSString *path = [bundle pathForResource:@"pose_landmarker_lite" ofType:@"task"];
    if (path.length > 0) return path;
  }
  return nil;
}

static UIImageOrientation FitTrackMultiPoseUnmirroredOrientation(
    UIImageOrientation orientation) {
  switch (orientation) {
    case UIImageOrientationUpMirrored:
      return UIImageOrientationUp;
    case UIImageOrientationDownMirrored:
      return UIImageOrientationDown;
    case UIImageOrientationLeftMirrored:
      return UIImageOrientationLeft;
    case UIImageOrientationRightMirrored:
      return UIImageOrientationRight;
    default:
      return orientation;
  }
}

@implementation FitTrackMultiPoseSessionRegistry

+ (BOOL)isAvailable {
  // Do not allocate a detector here. Older binaries can safely report false
  // when the optional model resource is absent.
  return FitTrackMultiPoseModelPath() != nil;
}

+ (NSString *)createSessionWithError:(NSError **)error {
  NSLock *registryLock = FitTrackMultiPoseRegistryLock();
  [registryLock lock];

  NSString *sessionId = nil;
  NSError *creationError = nil;
  @try {
    NSMutableDictionary<NSString *, FitTrackMultiPoseSession *> *sessions =
        FitTrackMultiPoseSessions();
    if (sessions.count >= kFitTrackMultiPoseMaximumSessions) {
      creationError = FitTrackMultiPoseError(
          @"session_limit", @"The maximum number of pose sessions is already active.");
    } else {
      NSString *modelPath = FitTrackMultiPoseModelPath();
      if (modelPath.length == 0) {
        creationError = FitTrackMultiPoseError(
            @"model_initialization_failed", @"The bundled pose model is unavailable.");
      } else {
        MPPPoseLandmarkerOptions *options = [[MPPPoseLandmarkerOptions alloc] init];
        options.baseOptions.modelAssetPath = modelPath;
        options.baseOptions.delegate = MPPDelegateCPU;
        options.runningMode = MPPRunningModeVideo;
        options.numPoses = 3;
        options.shouldOutputSegmentationMasks = NO;

        NSError *detectorError = nil;
        MPPPoseLandmarker *landmarker = [[MPPPoseLandmarker alloc]
            initWithOptions:options
                      error:&detectorError];
        if (landmarker == nil || detectorError != nil) {
          NSString *message = detectorError.localizedDescription.length > 0
                                  ? detectorError.localizedDescription
                                  : @"The pose model could not be initialized.";
          creationError = FitTrackMultiPoseError(@"model_initialization_failed", message);
        } else {
          do {
            sessionId = [NSUUID UUID].UUIDString;
          } while (sessions[sessionId] != nil);
          sessions[sessionId] = [[FitTrackMultiPoseSession alloc]
              initWithLandmarker:landmarker];
        }
      }
    }
  } @catch (NSException *exception) {
    creationError = FitTrackMultiPoseError(
        @"model_initialization_failed",
        exception.reason.length > 0 ? exception.reason : @"The pose model could not be initialized.");
    sessionId = nil;
  } @finally {
    [registryLock unlock];
  }

  if (sessionId == nil && error != NULL) {
    *error = creationError ?: FitTrackMultiPoseError(
                              @"model_initialization_failed",
                              @"The pose model could not be initialized.");
  }
  return sessionId;
}

+ (void)releaseSession:(NSString *)sessionId {
  if (sessionId.length == 0) return;

  FitTrackMultiPoseSession *session = nil;
  NSLock *registryLock = FitTrackMultiPoseRegistryLock();
  [registryLock lock];
  session = FitTrackMultiPoseSessions()[sessionId];
  [FitTrackMultiPoseSessions() removeObjectForKey:sessionId];
  [registryLock unlock];

  if (session == nil) return;

  [session.lock lock];
  // MPPPoseLandmarker has ARC-owned lifetime on iOS. Clearing the strong
  // reference under the same per-session lock waits for any synchronous
  // inference and safely releases the native task without an invented close API.
  session.closed = YES;
  session.landmarker = nil;
  [session.lock unlock];
}

+ (void)releaseAllSessions {
  NSArray<FitTrackMultiPoseSession *> *sessionsToRelease = nil;
  NSLock *registryLock = FitTrackMultiPoseRegistryLock();
  [registryLock lock];
  sessionsToRelease = [FitTrackMultiPoseSessions().allValues copy];
  [FitTrackMultiPoseSessions() removeAllObjects];
  [registryLock unlock];

  for (FitTrackMultiPoseSession *session in sessionsToRelease) {
    [session.lock lock];
    session.closed = YES;
    session.landmarker = nil;
    [session.lock unlock];
  }
}

+ (NSDictionary<NSString *, id> *)processFrame:(Frame *)frame
                                      sessionId:(NSString *)sessionId {
  FitTrackMultiPoseSession *session = nil;
  NSLock *registryLock = FitTrackMultiPoseRegistryLock();
  [registryLock lock];
  if (sessionId.length > 0) {
    session = FitTrackMultiPoseSessions()[sessionId];
  }
  [registryLock unlock];

  if (session == nil) {
    return FitTrackMultiPoseErrorResult(
        @"session_closed", @"The pose session is closed or was not found.");
  }

  [session.lock lock];
  NSDictionary<NSString *, id> *response = nil;
  @try {
    if (session.closed || session.landmarker == nil) {
      response = FitTrackMultiPoseErrorResult(
          @"session_closed", @"The pose session is closed or was not found.");
    } else if (frame == nil || !frame.isValid) {
      response = FitTrackMultiPoseErrorResult(
          @"invalid_frame", @"The VisionCamera frame is no longer valid.");
    } else {
      MPPImage *image = nil;
      NSError *imageError = nil;
      @try {
        // The sample buffer is borrowed from VisionCamera. MPPImage retains it
        // for this synchronous callback; this registry never closes or releases
        // the camera-owned frame.
        // VisionCamera reports mirroring separately through `frame.isMirrored`;
        // the preview owns that single mirror transform, so it is not folded
        // into MediaPipe's input orientation.
        UIImageOrientation orientation =
            FitTrackMultiPoseUnmirroredOrientation(frame.orientation);
        image = [[MPPImage alloc]
            initWithSampleBuffer:frame.buffer
                     orientation:orientation
                           error:&imageError];
      } @catch (NSException *exception) {
        imageError = FitTrackMultiPoseError(
            @"image_conversion_failed",
            exception.reason.length > 0 ? exception.reason : @"The camera image could not be converted.");
      }

      if (image == nil || imageError != nil) {
        NSString *message = imageError.localizedDescription.length > 0
                                ? imageError.localizedDescription
                                : @"The camera image could not be converted.";
        response = FitTrackMultiPoseErrorResult(@"image_conversion_failed", message);
      } else {
        double frameTimestampMs = frame.timestamp;
        if (!isfinite(frameTimestampMs)) {
          response = FitTrackMultiPoseErrorResult(
              @"invalid_frame", @"The camera frame has no valid timestamp.");
        } else {
          NSInteger timestampMs = (NSInteger)llround(frameTimestampMs);
          timestampMs = MAX(timestampMs, session.lastTimestampMs + 1);
          NSError *detectError = nil;
          MPPPoseLandmarkerResult *result = nil;
          @try {
            result = [session.landmarker detectVideoFrame:image
                                  timestampInMilliseconds:timestampMs
                                                     error:&detectError];
          } @catch (NSException *exception) {
            detectError = FitTrackMultiPoseError(
                @"inference_failed",
                exception.reason.length > 0 ? exception.reason : @"Pose inference failed.");
          }

          if (result == nil || detectError != nil) {
            NSString *message = detectError.localizedDescription.length > 0
                                    ? detectError.localizedDescription
                                    : @"Pose inference failed.";
            response = FitTrackMultiPoseErrorResult(@"inference_failed", message);
          } else {
            session.lastTimestampMs = timestampMs;
            NSMutableArray<NSDictionary<NSString *, id> *> *candidates =
                [NSMutableArray arrayWithCapacity:MIN(result.landmarks.count, 3)];
            BOOL hasMalformedCandidate = NO;
            NSUInteger poseIndex = 0;
            for (NSArray<MPPNormalizedLandmark *> *landmarks in result.landmarks) {
              NSUInteger currentPoseIndex = poseIndex++;
              if (candidates.count >= 3) break;
              if (landmarks.count != 33) {
                hasMalformedCandidate = YES;
                continue;
              }

              NSMutableArray<NSDictionary<NSString *, NSNumber *> *> *keypoints =
                  [NSMutableArray arrayWithCapacity:33];
              double confidence = 0.0;
              BOOL hasInvalidValue = NO;
              for (MPPNormalizedLandmark *landmark in landmarks) {
                double x = landmark.x;
                double y = landmark.y;
                double z = landmark.z;
                double visibility = landmark.visibility != nil
                                        ? landmark.visibility.doubleValue
                                        : 0.0;
                if (!isfinite(x) || !isfinite(y) || !isfinite(z) ||
                    !isfinite(visibility)) {
                  hasInvalidValue = YES;
                  break;
                }
                confidence += visibility;
                [keypoints addObject:@{
                  @"x" : @(x),
                  @"y" : @(y),
                  @"z" : @(z),
                  @"visibility" : @(visibility),
                }];
              }
              if (hasInvalidValue || keypoints.count != 33) {
                hasMalformedCandidate = YES;
                continue;
              }

              NSMutableDictionary<NSString *, id> *candidate = [@{
                @"confidence" : @(confidence / (double)keypoints.count),
                @"keypoints" : keypoints,
              } mutableCopy];
              if (currentPoseIndex < result.worldLandmarks.count) {
                NSArray<MPPLandmark *> *world = result.worldLandmarks[currentPoseIndex];
                if (world.count == 33) {
                  NSMutableArray *spatial = [NSMutableArray arrayWithCapacity:33];
                  for (NSUInteger i = 0; i < world.count; i++) {
                    MPPLandmark *point = world[i];
                    [spatial addObject:@{ @"x": @(point.x), @"y": @(point.y), @"z": @(point.z),
                                         @"visibility": keypoints[i][@"visibility"] }];
                  }
                  candidate[@"spatialKeypoints"] = spatial;
                }
              }
              [candidates addObject:candidate];
            }
            response = hasMalformedCandidate
                           ? FitTrackMultiPoseErrorResult(
                                 @"inference_failed", @"Pose inference returned malformed landmarks.")
                           : FitTrackMultiPoseSuccessResult(candidates);
          }
        }
      }
    }
  } @catch (NSException *exception) {
    response = FitTrackMultiPoseErrorResult(
        @"inference_failed",
        exception.reason.length > 0 ? exception.reason : @"Pose inference failed.");
  } @finally {
    [session.lock unlock];
  }

  return response ?: FitTrackMultiPoseErrorResult(
                         @"inference_failed", @"Pose inference failed.");
}

@end
