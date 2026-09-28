import ExpoModulesCore
import Foundation

private func fitTrackMultiPoseException(from error: NSError?) -> Exception {
  let nativeCode = error?.userInfo["code"] as? String
  let code = nativeCode.flatMap { $0.isEmpty ? nil : $0 } ?? "model_initialization_failed"
  let description = error?.localizedDescription ?? "The pose model could not be initialized."
  return Exception(name: "FitTrackMultiPoseError", description: description, code: code)
}

public final class FitTrackMultiPoseModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FitTrackMultiPose")

    Function("isAvailable") {
      FitTrackMultiPoseSessionRegistry.isAvailable()
    }

    AsyncFunction("createSession") {
      () throws -> String in
      var nativeError: NSError?
      guard let sessionId = FitTrackMultiPoseSessionRegistry.createSession(error: &nativeError) else {
        throw fitTrackMultiPoseException(from: nativeError)
      }
      return sessionId
    }

    AsyncFunction("releaseSession") { (sessionId: String) in
      FitTrackMultiPoseSessionRegistry.releaseSession(sessionId)
    }

    OnDestroy {
      FitTrackMultiPoseSessionRegistry.releaseAllSessions()
    }
  }
}
