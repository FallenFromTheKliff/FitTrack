# Gym Operations Current Code Reference

## Purpose

This document describes how the current `Gym Operations` web module works in the codebase today.

It is intentionally grounded in the current implementation and stays close to the existing skeleton:

- `Schedule`
- `Manage Coaches`
- `Coach Schedule`
- `Venue Bookings`

It also cross-references the `Facilities` module where Gym Operations depends on shared venue data.

## Route And Surface Ownership

- Web route: [apps/web/app/(admin)/schedule/page.tsx](C:/Users/Khristiane/Documents/GitHub/FitTrack/apps/web/app/(admin)/schedule/page.tsx)
- Shared venue-booking context: [apps/web/contexts/ScheduleContext.tsx](C:/Users/Khristiane/Documents/GitHub/FitTrack/apps/web/contexts/ScheduleContext.tsx)
- Main overlays and operational modals: [apps/web/components/schedule/GymOperationsOverlays.tsx](C:/Users/Khristiane/Documents/GitHub/FitTrack/apps/web/components/schedule/GymOperationsOverlays.tsx)

## Current Role Access

- Admin: has access to the Gym Operations route and booking decisions.
- Staff: has access to the Gym Operations route and booking decisions.
- Current codebase still contains `COACH` role wiring in other areas, but Gym Operations itself is currently built as an admin/staff operations surface.

## Top-Level Structure

The route currently behaves like a merged operations console with two major layers:

1. Primary route mode
   - `Schedule`
   - `Manage Coaches`

2. Schedule sub-mode
   - `Coach Schedule`
   - `Venue Bookings`

That means the page is not a single flat calendar. It is an operations shell with:

- coach appointment review
- live booking review
- coach data management
- coach availability editing

## Main Data Sources

### Coach And Appointment Data

- Staff/domain client: [packages/api-client/domains/staff.ts](C:/Users/Khristiane/Documents/GitHub/FitTrack/packages/api-client/domains/staff.ts)
- Staff query layer: [packages/query/staff.ts](C:/Users/Khristiane/Documents/GitHub/FitTrack/packages/query/staff.ts)

Current Gym Operations coach-side data comes from:

- `client.staff.listCoaches()`
- `client.staff.listAppointments(...)`
- `client.staff.replaceCoachAvailability(...)`
- `client.staff.updateCoachProfile(...)`
- `client.staff.respondToAppointment(...)`
- `client.staff.completeAppointment(...)`
- `client.staff.cancelAppointment(...)`

### Venue Booking Data

- Shared schedule context: [apps/web/contexts/ScheduleContext.tsx](C:/Users/Khristiane/Documents/GitHub/FitTrack/apps/web/contexts/ScheduleContext.tsx)

Venue-booking review data comes from:

- staff path: `client.staff.listBookings()`
- admin path: admin booking queries used by `ScheduleContext`

Those venue-booking records are mapped into the Gym Operations schedule tables and review modal.

### Facilities / Venue Source Of Truth

- Venue query layer: [packages/query/venues.ts](C:/Users/Khristiane/Documents/GitHub/FitTrack/packages/query/venues.ts)
- Venue API client: [packages/api-client/domains/venues.ts](C:/Users/Khristiane/Documents/GitHub/FitTrack/packages/api-client/domains/venues.ts)
- Facilities hook: [apps/web/hooks/facilities/useFacilities.ts](C:/Users/Khristiane/Documents/GitHub/FitTrack/apps/web/hooks/facilities/useFacilities.ts)

Active venue records are loaded from:

- `GET /bookings/amenities`

That same contract is used by:

- web Facilities
- mobile Facilities
- mobile Bookings

So venue naming, reservable state, and amenity-backed availability are intended to come from one shared backend source.

## How The Current Page Works

## 1. Schedule Mode

This is the default operations workbench.

It currently contains:

- coach schedule view
- venue bookings review view
- summary metric cards
- filter controls
- booking/appointment review modals

### Coach Schedule

Purpose:

- visualize coach appointments
- inspect a selected coach
- review coach session state

Current behavior:

- coach roster is built from the loaded coach list
- focused coach state drives the schedule lane
- appointment actions open the coach appointment modal
- recurring-plan controls are attached to appointment actions when relevant

Current coach appointment actions include:

- confirm
- reject
- keep pending
- cancel
- mark complete

These are currently handled through:

- staff appointment response mutations
- completion mutations
- cancellation mutations

### Venue Bookings

Purpose:

- review member venue bookings inside the same operations route
- approve or reject pending bookings
- inspect venue pressure and booking timing

Current behavior:

- bookings are loaded through `ScheduleContext`
- filter bar supports venue filter and status filter
- metrics summarize visible, pending, confirmed, and active-venue counts
- clicking `Review` opens the venue booking modal

Current venue review modal includes:

- booking summary
- conflict context panel
- decision path
- audit note

Current decision actions:

- approve
- request new slot
- reject

## 2. Manage Coaches Mode

This is the contained coach-management side of Gym Operations.

Purpose:

- manage coach operational metadata without leaving the route
- maintain coach booking readiness
- maintain coach availability

Current behavior:

- shows coach roster and coach search
- lets admin/staff focus a coach profile
- exposes coach visibility and profile actions
- opens availability editing through the Manage Availability drawer/modal
- supports `Open in Schedule`

Coach-side data currently includes:

- name
- specialization
- bio
- certification
- hourly rate
- booking visibility
- availability slots

## Manage Availability: Current Implementation

Current availability editor is in:

- [apps/web/components/schedule/GymOperationsOverlays.tsx](C:/Users/Khristiane/Documents/GitHub/FitTrack/apps/web/components/schedule/GymOperationsOverlays.tsx)

Current structure:

- title/header
- booking visibility state
- weekly lane control rows
- per-row time editors
- remove row action
- hide-from-booking action
- save schedule action

Current persistence path:

- `client.staff.replaceCoachAvailability(...)`

So the current availability editor is not local-only. It already writes through the staff backend contract.

## Facilities Coupling

Gym Operations is operationally connected to Facilities through the shared venue/amenity system.

### Shared Venue Source

The same `venuesQueryOptions(...)` path is used by:

- web Facilities
- mobile Facilities
- mobile Bookings

That query resolves to:

- [packages/api-client/domains/venues.ts](C:/Users/Khristiane/Documents/GitHub/FitTrack/packages/api-client/domains/venues.ts)
- `GET /bookings/amenities`

### What That Means For Gym Operations

When Gym Operations shows venue bookings, the booking records are tied to the same amenity-backed venue records managed in Facilities.

So Facilities affects Gym Operations through:

- venue names
- reservable vs non-reservable status
- venue archive/restore lifecycle
- venue availability logic

### What Mobile Bookings Shares

Mobile Bookings pulls venues through:

- [apps/mobile/app/(tabs)/bookings.tsx](C:/Users/Khristiane/Documents/GitHub/FitTrack/apps/mobile/app/(tabs)/bookings.tsx)
- [apps/mobile/components/modals/booking/ReservationModal.tsx](C:/Users/Khristiane/Documents/GitHub/FitTrack/apps/mobile/components/modals/booking/ReservationModal.tsx)

That means the member-facing venue picker is intended to stay aligned with Facilities-managed venues.

## Current Connected Truths

These are the key shared truths already present in code:

- venue records are amenity-backed
- Facilities manages those venue records
- mobile venue selection reads from the same venue contract
- Gym Operations venue-booking review consumes bookings tied to those venues
- coach availability and coach profile updates already have backend persistence paths

## Current Gaps To Remember

This section is not a redesign brief. It is just the current implementation truth that still matters when reading the module:

- Gym Operations does not yet behave like a full manual booking-creation console.
- `Create Coach` as a standalone coach flow is not yet implemented in the current route.
- `COACH` role cleanup has not yet been fully removed across the system.
- The current availability editor is functional, but still relatively dense and operationally plain.

## Practical Summary

Today, Gym Operations works as:

- one merged admin/staff route
- one live schedule/booking operations area
- one contained coach-management area
- one venue-booking review workflow
- one coach availability/profile maintenance workflow

And it is connected to Facilities because the venue side of the route is built on the same amenity/venue records that Facilities manages and mobile surfaces consume.
