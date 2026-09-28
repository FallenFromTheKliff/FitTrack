#pragma once

#import <Foundation/Foundation.h>
#import <VisionCamera/Frame.h>

NS_ASSUME_NONNULL_BEGIN

FOUNDATION_EXPORT NSString *const FitTrackMultiPoseErrorDomain;

/**
 * Owns the optional MediaPipe Pose Landmarker sessions used by the VisionCamera
 * frame processor. The registry is the only native owner of detectors.
 */
@interface FitTrackMultiPoseSessionRegistry : NSObject

/** A cheap capability check; this never creates a detector or touches media. */
+ (BOOL)isAvailable;

/** Creates one CPU VIDEO detector and returns its opaque session token. */
+ (nullable NSString *)createSessionWithError:(NSError * _Nullable * _Nullable)error
    NS_SWIFT_NOTHROW NS_SWIFT_NAME(createSession(error:));

/** Releases only the matching session. Releasing an unknown token is a no-op. */
+ (void)releaseSession:(NSString *)sessionId;

/** Releases every session owned by this module instance. */
+ (void)releaseAllSessions;

/** Dispatches one synchronous frame through the matching session. */
+ (NSDictionary<NSString *, id> *)processFrame:(Frame *)frame
                                     sessionId:(NSString *)sessionId
    NS_SWIFT_NAME(processFrame(_:sessionId:));

@end

NS_ASSUME_NONNULL_END
