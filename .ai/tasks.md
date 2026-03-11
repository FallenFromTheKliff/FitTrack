# Mobile Feature Sprint & Logic Unification

## 1. Workouts & Camera Integration
- [ ] **Workouts Screen**: Design the layout with a central camera button.
- [ ] **CameraModal**: 
    - Implement using `expo-camera`.
    - Extract styles from `makeWorkoutStyles` (in `ScreenStyles.ts`) and relocate to `ModalStyles.ts`.
- [ ] **Trigger**: Ensure the camera button opens the `CameraModal` and activates the lens.

## 2. Profile & Auth Integration
- [ ] **AuthContext Update**: Add an `updateUser` function to `AuthContext` to handle profile edits.
- [ ] **EditProfile Screen**: 
    - Utilize `AuthContext` to update `name`, `email`, and `phone`.
    - Ensure updates persist to storage and reflect immediately in the `User` state.
- [ ] **PreferencesMock**: Delete the `dev/` folder in Web; move `PreferencesMock` data to `apps/web/data/dashboard.ts`.

## 3. Shared Utils & Types
- [ ] **Password Logic**: Move `revisePassword` to `packages/utils/src/index.ts`.
- [ ] **Clean Up**: Delete local `revisePassword` instances in `apps/web` and `apps/mobile`.
- [ ] **Mock Unification**: Synchronize the "Mock User" object between Web and Mobile; move both to their respective `/data/` folders.
- [ ] **Type Audit**: Move any local, compatible interfaces to `packages/types/src/index.ts`.

## 4. Booking Screen Bug Fix & Refactor
- [ ] **Trainer Bug**: Fix the crash occurring during trainer checks.
- [ ] **Component Consolidation**: 
    - Delete the `BookCard` function.
    - Modify the shared `FitCard` to support booking fields (trainer, time, date).
    - Update `BookingScreen` to map data using the enhanced `FitCard`.

## 5. Final Code Cleanup
- [ ] **Redundancy**: Remove unused imports and redundant logic.
- [ ] **Formatting**: Remove exaggerated spaces and trailing commas.
- [ ] **Zero-Comment Policy**: Ensure no code comments remain.