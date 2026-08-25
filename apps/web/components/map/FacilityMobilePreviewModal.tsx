"use client";

import { useState } from "react";
import { Smartphone } from "lucide-react";
import type { FacilityFloorId, FacilityMapSnapshot } from "@fittrack/types";

import FitButton from "@/components/fit/FitButton";
import { FitText } from "@/components/fit/FitText";
import FitModal from "@/components/modals/FitModal";
import { MemberFacilitiesMap } from "@/components/member-only/MemberFacilitiesMap";
import { mapSnapshotFloorVenues } from "@/components/member-only/facilityMapViewModel";
import { useTheme } from "@/contexts/ThemeContext";

type Props = {
  isError: boolean;
  isFetching?: boolean;
  isLoading: boolean;
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
  snapshot: FacilityMapSnapshot | undefined;
};

export function FacilityMobilePreviewModal({
  isError,
  isFetching = false,
  isLoading,
  isOpen,
  onClose,
  onRetry,
  snapshot,
}: Props) {
  const { colors } = useTheme();
  const [activeFloor, setActiveFloor] = useState<FacilityFloorId>("floor-1");
  const floor = snapshot?.floors.find((candidate) => candidate.floorId === activeFloor);
  const venues = mapSnapshotFloorVenues(floor);

  return (
    <FitModal
      isOpen={isOpen}
      onClose={onClose}
      title="Member mobile map preview"
      subtitle="Published facility snapshot · admin controls stay outside the phone view."
      icon={Smartphone}
      maxWidth={520}
      closeAriaLabel="Close member mobile map preview"
      containerStyle={{
        width: "min(100%, 520px)",
        maxHeight: "94vh",
      }}
      contentStyle={{
        backgroundColor: colors.base,
        maxHeight: "calc(94vh - 112px)",
        overflowY: "auto",
        padding: 12,
      }}
    >
      <div
        aria-label="Published member mobile map"
        style={{
          backgroundColor: colors.base,
          border: `1px solid ${colors.border}`,
          borderRadius: 18,
          boxShadow: `0 12px 30px ${colors.overlay}`,
          margin: "0 auto",
          maxWidth: 430,
          padding: 8,
          width: "100%",
        }}
      >
        {isLoading && !snapshot ? (
          <div role="status" style={{ display: "grid", gap: 8, padding: 32, textAlign: "center" }}>
            <FitText style={{ color: colors.textPrimary, fontWeight: 800 }}>
              Loading published map
            </FitText>
            <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
              Reading the same floor snapshot used by member and mobile surfaces.
            </FitText>
          </div>
        ) : isError && !snapshot ? (
          <div role="alert" style={{ display: "grid", gap: 10, padding: 32, textAlign: "center" }}>
            <FitText style={{ color: colors.textPrimary, fontWeight: 800 }}>
              Published map unavailable
            </FitText>
            <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
              The current facilities snapshot could not be loaded.
            </FitText>
            <FitButton
              label={isFetching ? "RETRYING..." : "RETRY SNAPSHOT"}
              disabled={isFetching}
              onClick={onRetry}
            />
          </div>
        ) : floor ? (
          <MemberFacilitiesMap
            activeFloor={activeFloor}
            floorImageUrl={floor.imageUrl}
            footprintCells={floor.footprintCells}
            pathCells={floor.pathCells}
            entryCells={floor.entryCells}
            exitCells={floor.exitCells}
            equipment={floor.equipment}
            isLoading={isFetching && !snapshot}
            onFloorChange={setActiveFloor}
            phonePreview
            venues={venues}
          />
        ) : (
          <div role="status" style={{ display: "grid", gap: 8, padding: 32, textAlign: "center" }}>
            <FitText style={{ color: colors.textPrimary, fontWeight: 800 }}>
              No published floor data
            </FitText>
            <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
              Save a facilities map before opening the member preview.
            </FitText>
          </div>
        )}
      </div>
    </FitModal>
  );
}
