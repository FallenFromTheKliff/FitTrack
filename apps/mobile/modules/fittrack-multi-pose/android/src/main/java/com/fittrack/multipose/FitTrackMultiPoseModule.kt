package com.fittrack.multipose

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class FitTrackMultiPoseModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FitTrackMultiPose")

    Function("isAvailable") {
      FitTrackMultiPoseFrameProcessorPlugin.isAvailable()
    }

    AsyncFunction("createSession") {
      FitTrackMultiPoseFrameProcessorPlugin.createSession()
    }

    AsyncFunction("releaseSession") { sessionId: String ->
      FitTrackMultiPoseFrameProcessorPlugin.releaseSession(sessionId)
    }

    OnCreate {
      appContext.reactContext?.let(FitTrackMultiPoseFrameProcessorPlugin::register)
    }

    OnDestroy {
      FitTrackMultiPoseFrameProcessorPlugin.releaseAll()
    }
  }
}
