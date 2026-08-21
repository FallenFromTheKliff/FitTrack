# Local Gym Equipment Provider Setup

Batch 7 now supports a local AI equipment provider for weighted-rep integrity. The mobile app still sends throttled snapshots through the authenticated Nest API; Nest delegates to the existing AI microservice on port 8000.

## Architecture

```text
Mobile native workout camera
  -> POST /v1/workout/equipment/detect
  -> Nest PoseService
  -> AI microservice POST /equipment/detect
  -> local YOLO best.pt
  -> normalized equipment context back to mobile
```

The legacy `/v1/pose/equipment/analyze` endpoint remains available, but the shared API client now uses `/v1/workout/equipment/detect`.

## Model Placement

Train or export the gym detector as YOLO weights and place it here:

```text
apps/ai-microservice/models/gym-equipment/best.pt
```

Override the location when needed:

```env
EQUIPMENT_DETECTION_MODEL_PATH=C:\absolute\path\to\best.pt
```

The model file is intentionally not committed to git.

## Environment Contract

Set these values in the root `.env`:

```env
AI_API_BASE_URL=http://localhost:8000
EQUIPMENT_DETECTION_PROVIDER=local_ai
EQUIPMENT_DETECTION_REQUEST_TIMEOUT_MS=5000
EQUIPMENT_DETECTION_CONFIDENCE_THRESHOLD=0.35
```

The Roboflow hosted provider is still supported for fallback experiments:

```env
EQUIPMENT_DETECTION_PROVIDER=roboflow
ROBOFLOW_API_BASE_URL=https://serverless.roboflow.com
ROBOFLOW_API_KEY=...
ROBOFLOW_MODEL_ID=workspace/model/version
```

## Python Dependency

The AI microservice route is lazy: if `best.pt` or `ultralytics` is missing, it returns a safe `equipment_model_unavailable` or `equipment_model_dependency_missing` conflict instead of crashing the stack.

After `best.pt` is ready, install and lock the runtime dependency from `apps/ai-microservice`:

```powershell
uv add ultralytics
```

Do this once before relying on local YOLO inference in the dev stack.

## Runtime Behavior

- The native mobile app sends compressed snapshots only while recording weighted exercises.
- The API normalizes model labels into FitTrack contexts: `dumbbell`, `barbell`, `cable`, `machine`, `kettlebell`, `band`, `bench`, `mixed`, or `unknown`.
- Bodyweight exercises keep counting without equipment detection.
- Weighted exercises can count as unverified fallback only after the provider was checked and missed; verified counting requires compatible equipment context.
- Raw frames are not persisted.

## Attribution

Gym equipment detection model trained on:

```text
FitFuel All Gym Equipment Dataset (CC BY 4.0)
https://universe.roboflow.com/fitfuel/all-gym-equipment
```

Add this line to the capstone paper, README, and demo slide deck.
