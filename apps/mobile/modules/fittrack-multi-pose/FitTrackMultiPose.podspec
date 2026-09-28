require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  # The npm package is scoped, but CocoaPods spec/module names cannot use the
  # package's @scope/name form.
  s.name = "FitTrackMultiPose"
  s.module_name = "FitTrackMultiPose"
  s.version = package["version"]
  s.summary = "Optional MediaPipe multi-person pose frame processor for FitTrack"
  s.homepage = "https://github.com/FallenFromTheKliff/FitTrack"
  s.authors = "FitTrack"
  s.platforms = { ios: "12.4" }
  s.source = { path: "." }
  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.public_header_files = "ios/**/*.h"
  s.resources = "ios/Resources/pose_landmarker_lite.task"
  s.requires_arc = true
  s.dependency "ExpoModulesCore"
  s.dependency "VisionCamera"
  s.dependency "MediaPipeTasksVision", "0.10.21"
end
