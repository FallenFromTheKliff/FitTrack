# FitTrack Sprint: Codex 5.3 Mobile Refinement

## 1. Initialization & Animation
- [ ] **First Command Rule**: Verify agent has loaded all `.ai/` rules.
- [ ] **Animated Settings**: Implement `useThemeTransition` in `settings/index.tsx` and sub-screens for fluid theme interpolation.
- [ ] **Facilities Content**: Update "Amenities" to the Giant Label + Sub-label visual hierarchy.

## 2. CalendarModal (Mobile)
- [ ] **Curved Box Selection**: Replace circles with curved boxes; increase date font size.
- [ ] **Theme-Aware Selection**: Implement Darker BG / Brighter Font colors for active dates.
- [ ] **Date Logic**: Implement auto-shifting `minDate` for `DueDate` based on `StartDate` selection.

## 3. Reservation & Booking Context
- [ ] **Price Field**: Insert 'Price' input above 'Description'.
- [ ] **Dual-Time System**: 
    - Replace 'Duration' with Start/End time fields.
    - Implement +1hr auto-calculation for End Time.
    - Add "Unavailable" validation for schedule collisions.
- [ ] **Context Sync**: Update `BookingContext` state to store new dual-time and price data dynamically.

## 4. Code Health (Mobile Only)
- [ ] **Mock Data Purge**: Relocate hardcoded strings from screens to `apps/mobile/data/`.
- [ ] **Cleanup**: 
    - Strip all comments.
    - Remove exaggerated vertical spaces.
    - Remove trailing commas in objects and arrays.
- [ ] **Imports**: Consolidate and remove unused imports.

## 5. Verification
- [ ] Confirm `ReservationModal` validation requires both time fields.
- [ ] Confirm `Settings` theme-swap uses animated transitions.