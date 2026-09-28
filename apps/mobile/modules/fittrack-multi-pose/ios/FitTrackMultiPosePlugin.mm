#import <VisionCamera/FrameProcessorPlugin.h>

#import "FitTrackMultiPoseSessionRegistry.h"

@interface FitTrackMultiPosePlugin : FrameProcessorPlugin
@property(nonatomic, copy, nullable) NSString *configuredSessionId;
@end

@implementation FitTrackMultiPosePlugin

- (instancetype)initWithProxy:(VisionCameraProxyHolder*)proxy
                   withOptions:(NSDictionary* _Nullable)options {
  self = [super initWithProxy:proxy withOptions:options];
  if (self) {
    id sessionId = options[@"sessionId"];
    if ([sessionId isKindOfClass:[NSString class]] && [sessionId length] > 0) {
      self.configuredSessionId = sessionId;
    }
  }
  return self;
}

- (id _Nullable)callback:(Frame*)frame
         withArguments:(NSDictionary* _Nullable)arguments {
  id callbackSessionId = arguments[@"sessionId"];
  NSString *sessionId = self.configuredSessionId;
  if (callbackSessionId != nil) {
    sessionId = [callbackSessionId isKindOfClass:[NSString class]]
                    ? callbackSessionId
                    : @"";
  }
  return [FitTrackMultiPoseSessionRegistry processFrame:frame
                                               sessionId:sessionId ?: @""];
}

VISION_EXPORT_FRAME_PROCESSOR(FitTrackMultiPosePlugin, fittrackMultiPose)

@end
