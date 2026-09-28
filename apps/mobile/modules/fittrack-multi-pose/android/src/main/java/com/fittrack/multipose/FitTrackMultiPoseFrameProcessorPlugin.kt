package com.fittrack.multipose

import android.content.Context
import android.graphics.Bitmap
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.ImageProcessingOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry
import expo.modules.kotlin.exception.CodedException
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.max

/** Optional multi-person path. The existing MLKit plugin remains the Off path. */
object FitTrackMultiPoseFrameProcessorPlugin {
  const val NAME = "fittrackMultiPose"
  const val MODEL_ASSET = "pose_landmarker_lite.task"
  private const val MAX_POSES = 3
  private const val MAX_SESSIONS = 2
  private val registered = AtomicBoolean(false)
  @Volatile private var applicationContext: Context? = null
  private val sessions = ConcurrentHashMap<String, FitTrackMultiPoseSession>()

  fun register(context: Context) {
    applicationContext = context.applicationContext
    if (!registered.compareAndSet(false, true)) return

    FrameProcessorPluginRegistry.addFrameProcessorPlugin(NAME) { _, options ->
      FitTrackMultiPoseFrameProcessor(options?.get("sessionId") as? String)
    }
  }

  fun isAvailable(): Boolean = registered.get() && applicationContext != null

  @Synchronized
  fun createSession(): String {
    val context = applicationContext
      ?: throw CodedException(
        "native_bridge_unavailable",
        "Subject tracking is unavailable in this mobile build.",
        null,
      )
    if (sessions.size >= MAX_SESSIONS) {
      throw CodedException(
        "session_limit",
        "Subject tracking already has the maximum number of active sessions.",
        null,
      )
    }

    val landmarker = try {
      createLandmarker(context)
    } catch (error: Exception) {
      throw CodedException(
        "model_initialization_failed",
        error.message ?: "Subject tracking could not initialize its pose model.",
        error,
      )
    }
    val sessionId = UUID.randomUUID().toString()
    sessions[sessionId] = FitTrackMultiPoseSession(landmarker)
    return sessionId
  }

  /** Idempotent; waits for an in-flight callback before closing this handle. */
  @Synchronized
  fun releaseSession(sessionId: String) {
    val session = sessions.remove(sessionId) ?: return
    session.close()
  }

  @Synchronized
  fun releaseAll() {
    val ownedSessions = sessions.keys.toList()
    ownedSessions.forEach(::releaseSession)
  }

  fun detect(sessionId: String?, frame: Frame): Any {
    val session = sessionId?.let(sessions::get)
      ?: return errorResult(
        "session_closed",
        "Subject tracking session is closed.",
      )
    return session.detect(frame)
  }

  private fun createLandmarker(context: Context): PoseLandmarker {
    val baseOptions = BaseOptions.builder()
      .setModelAssetPath(MODEL_ASSET)
      .build()
    val options = PoseLandmarker.PoseLandmarkerOptions.builder()
      .setBaseOptions(baseOptions)
      .setRunningMode(RunningMode.VIDEO)
      .setNumPoses(MAX_POSES)
      .setMinPoseDetectionConfidence(0.5f)
      .setMinPosePresenceConfidence(0.5f)
      .setMinTrackingConfidence(0.5f)
      .setOutputSegmentationMasks(false)
      .build()
    return PoseLandmarker.createFromOptions(context, options)
  }

  internal fun errorResult(code: String, message: String): Map<String, Any> =
    mapOf("status" to "error", "code" to code, "message" to message)

  internal fun successResult(candidates: List<Map<String, Any>>): Map<String, Any> =
    mapOf("status" to "ok", "candidates" to candidates)
}

private class FitTrackMultiPoseFrameProcessor(
  private val configuredSessionId: String?,
) : FrameProcessorPlugin() {
  override fun callback(frame: Frame, params: MutableMap<String, Any>?): Any? {
    val callbackSessionId = params?.get("sessionId") as? String
    return FitTrackMultiPoseFrameProcessorPlugin.detect(
      callbackSessionId ?: configuredSessionId,
      frame,
    )
  }
}

private class FitTrackMultiPoseSession(
  private val landmarker: PoseLandmarker,
) {
  private val inferenceLock = Any()
  private var closed = false
  private var lastTimestampMs = Long.MIN_VALUE
  private var ownedBitmap: Bitmap? = null
  private var ownedImage: MPImage? = null
  private var pixelScratch: IntArray? = null
  private var scratchWidth = 0
  private var scratchHeight = 0

  fun detect(frame: Frame): Any {
    synchronized(inferenceLock) {
      if (closed) {
        return FitTrackMultiPoseFrameProcessorPlugin.errorResult(
          "session_closed",
          "Subject tracking session is closed.",
        )
      }
      if (!frame.isValid) {
        return FitTrackMultiPoseFrameProcessorPlugin.errorResult(
          "invalid_frame",
          "Subject tracking received an invalid camera frame.",
        )
      }

      val imageProxy = frame.imageProxy
      val bitmap = try {
        toOwnedArgbBitmap(frame)
      } catch (error: ImageConversionException) {
        return FitTrackMultiPoseFrameProcessorPlugin.errorResult(
          "image_conversion_failed",
          error.message ?: "Subject tracking could not convert the camera image.",
        )
      } catch (error: Exception) {
        return FitTrackMultiPoseFrameProcessorPlugin.errorResult(
          "image_conversion_failed",
          error.message ?: "Subject tracking could not convert the camera image.",
        )
      }

      val image = try {
        ownedImage ?: BitmapImageBuilder(bitmap).build().also { ownedImage = it }
      } catch (error: Exception) {
        releaseOwnedImage()
        return FitTrackMultiPoseFrameProcessorPlugin.errorResult(
          "image_conversion_failed",
          error.message ?: "Subject tracking could not wrap the camera image.",
        )
      }

      return try {
        val imageOptions = ImageProcessingOptions.builder()
          .setRotationDegrees(imageProxy.imageInfo.rotationDegrees)
          .build()
        val timestampMs = max(lastTimestampMs + 1L, frame.timestamp / 1_000_000L)
        lastTimestampMs = timestampMs
        val result = landmarker.detectForVideo(image, imageOptions, timestampMs)
        val candidates = result.landmarks().take(3).mapIndexedNotNull { index, landmarks ->
          if (landmarks.size != 33) return@mapIndexedNotNull null
          val points = landmarks.map { landmark ->
            mapOf<String, Any>(
              "x" to landmark.x().toDouble(),
              "y" to landmark.y().toDouble(),
              "z" to landmark.z().toDouble(),
              "visibility" to landmark.visibility().orElse(0f).toDouble(),
            )
          }
          val confidence = points
            .map { point -> (point["visibility"] as Number).toDouble() }
            .average()
          val candidate = mutableMapOf<String, Any>("confidence" to confidence, "keypoints" to points)
          result.worldLandmarks().getOrNull(index)?.takeIf { it.size == 33 }?.let { world ->
            candidate["spatialKeypoints"] = world.mapIndexed { pointIndex, landmark ->
              mapOf<String, Any>(
                "x" to landmark.x().toDouble(), "y" to landmark.y().toDouble(),
                "z" to landmark.z().toDouble(), "visibility" to points[pointIndex]["visibility"]!!,
              )
            }
          }
          candidate
        }
        FitTrackMultiPoseFrameProcessorPlugin.successResult(candidates)
      } catch (error: Exception) {
        FitTrackMultiPoseFrameProcessorPlugin.errorResult(
          "inference_failed",
          error.message ?: "Subject tracking inference failed.",
        )
      }
    }
  }

  /**
   * VisionCamera owns the ImageProxy and its borrowed Image. MediaPipe gets a
   * bounded ARGB bitmap copy whose lifecycle is owned by this session.
   */
  private fun toOwnedArgbBitmap(frame: Frame): Bitmap {
    val proxy = frame.imageProxy
    val width = frame.width
    val height = frame.height
    if (width <= 0 || height <= 0) {
      throw ImageConversionException("Subject tracking received an empty camera frame.")
    }
    val plane = proxy.planes.firstOrNull()
      ?: throw ImageConversionException("Subject tracking received no RGB image plane.")
    if (plane.pixelStride < 4 || plane.rowStride <= 0) {
      throw ImageConversionException("Subject tracking received an unsupported RGB image layout.")
    }
    if (width != proxy.width || height != proxy.height) {
      throw ImageConversionException(
        "Subject tracking received frame metadata that does not cover the raw image.",
      )
    }

    val pixelCount = try {
      Math.multiplyExact(width, height)
    } catch (error: ArithmeticException) {
      throw ImageConversionException("Subject tracking received an oversized camera frame.")
    }
    if (
      ownedBitmap == null || ownedBitmap?.width != width ||
      ownedBitmap?.height != height || ownedBitmap?.isRecycled == true
    ) {
      releaseOwnedImage()
      ownedBitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
      pixelScratch = IntArray(pixelCount)
      scratchWidth = width
      scratchHeight = height
    }
    val bitmap = ownedBitmap
      ?: throw ImageConversionException("Subject tracking could not allocate an image buffer.")
    val pixels = pixelScratch
      ?: throw ImageConversionException("Subject tracking could not allocate an image buffer.")
    if (scratchWidth != width || scratchHeight != height || pixels.size != pixelCount) {
      throw ImageConversionException("Subject tracking image buffer dimensions changed unexpectedly.")
    }

    val bytes = plane.buffer.duplicate()
    val rowStride = plane.rowStride
    val lastOffset = (height - 1) * rowStride +
      (width - 1) * plane.pixelStride + 3
    if (lastOffset < 0 || lastOffset >= bytes.limit()) {
      throw ImageConversionException("Subject tracking received a truncated RGB image plane.")
    }
    for (y in 0 until height) {
      val rowOffset = y * rowStride
      for (x in 0 until width) {
        val offset = rowOffset + x * plane.pixelStride
        val red = bytes.get(offset).toInt() and 0xff
        val green = bytes.get(offset + 1).toInt() and 0xff
        val blue = bytes.get(offset + 2).toInt() and 0xff
        pixels[y * width + x] =
          (0xff shl 24) or (red shl 16) or (green shl 8) or blue
      }
    }
    bitmap.setPixels(pixels, 0, width, 0, 0, width, height)
    return bitmap
  }

  fun close() {
    synchronized(inferenceLock) {
      if (closed) return
      closed = true
      releaseOwnedImage()
      try {
        landmarker.close()
      } catch (_: Exception) {
        // The handle is already closed and removed from the registry.
      }
    }
  }

  /** Releases the one MediaPipe wrapper and its owned bitmap under inferenceLock. */
  private fun releaseOwnedImage() {
    val image = ownedImage
    val bitmap = ownedBitmap
    ownedImage = null
    ownedBitmap = null
    pixelScratch = null
    scratchWidth = 0
    scratchHeight = 0
    try {
      image?.close()
    } catch (_: Exception) {
      // Bitmap cleanup below still bounds the owned buffer when wrapper close fails.
    }
    if (bitmap != null && !bitmap.isRecycled) {
      bitmap.recycle()
    }
  }
}

private class ImageConversionException(message: String) : RuntimeException(message)
