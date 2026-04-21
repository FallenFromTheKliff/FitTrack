import { useState, useCallback, useEffect, useMemo } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useFocusEffect, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsFocused } from "@react-navigation/native";
import { Dumbbell, RefreshCw, MessageCircle, CalendarPlus } from "lucide-react-native";
import { invalidateVenueQueries, venuesQueryOptions } from "@fittrack/query";
import {
  FACILITY_FLOORS,
  FACILITY_FLOOR_MAP,
  GYM_LAYOUT_GRID_COLUMNS,
  GYM_LAYOUT_GRID_ROWS,
  buildFacilityFloorVenues,
  type FacilityFloorId
} from "@fittrack/types";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { type FABMenuItem, useFABState } from "@/contexts/FABStateContext";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { makeScreenStyles, makeGymMapStyles } from "@/styles/shared/ScreenStyles";
import { mobileApiClient } from "@/lib/api-client";
import { getVenuePresentation } from "@/utils/venueBookings";
import { getVenueIcon } from "@/utils/venueMap";

import FitButton from "@/components/fit/FitButton";
import { FitText } from "@/components/fit/FitText";
import FitSection from "@/components/fit/FitSection";
import DetailsModal from "@/components/modals/booking/DetailsModal";

const GRID_COLUMNS = GYM_LAYOUT_GRID_COLUMNS;
const GRID_ROWS = GYM_LAYOUT_GRID_ROWS;

type BlueprintMarkerTone = "muted" | "primary";

type BlueprintMarker = {
  hint: string;
  label: string;
  left: number;
  top: number;
  tone: BlueprintMarkerTone;
  width: number;
  height: number;
};

const FACILITY_BLUEPRINT_COPY: Record<
  FacilityFloorId,
  {
    description: string;
    eyebrow: string;
    routeLabel: string;
    markers: BlueprintMarker[];
  }
> = {
  "floor-1": {
    description: "Entry-friendly view with the lobby edge, open training floor, and main court lanes laid out along one readable path.",
    eyebrow: "Orientation Path",
    routeLabel: "Main circulation lane",
    markers: [
      { hint: "Arrival and check-in", label: "Entry", left: 6, top: 8, tone: "muted", width: 22, height: 18 },
      { hint: "Free movement and machine zone", label: "Training", left: 31, top: 12, tone: "primary", width: 29, height: 28 },
      { hint: "Court-side wayfinding", label: "Courts", left: 63, top: 12, tone: "muted", width: 27, height: 34 }
    ]
  },
  "floor-2": {
    description: "A tighter training annex with coaching and ring-side movement kept readable through one central spine.",
    eyebrow: "Focused Zone",
    routeLabel: "Coach access lane",
    markers: [
      { hint: "Warm-up and prep", label: "Prep", left: 12, top: 18, tone: "muted", width: 22, height: 22 },
      { hint: "Main session zone", label: "Ring", left: 39, top: 24, tone: "primary", width: 32, height: 28 },
      { hint: "Support edge", label: "Recovery", left: 72, top: 18, tone: "muted", width: 16, height: 22 }
    ]
  },
  "floor-3": {
    description: "The studio floor stays calm and open, with the blueprint layer acting as a soft guide instead of a busy architectural diagram.",
    eyebrow: "Studio Flow",
    routeLabel: "Quiet movement lane",
    markers: [
      { hint: "Light prep zone", label: "Prep", left: 10, top: 18, tone: "muted", width: 18, height: 18 },
      { hint: "Main studio footprint", label: "Studio", left: 31, top: 18, tone: "primary", width: 40, height: 40 },
      { hint: "Stretch edge", label: "Stretch", left: 74, top: 22, tone: "muted", width: 14, height: 22 }
    ]
  }
};

export default function FacilitiesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isFocused = useIsFocused();
  const { colors } = useTheme();
  const { registerFAB, unregisterFAB, setReservationOpen } = useFABState();
  const { opacity, translateY } = usePassageAnim({ mode: "focus" });
  const base = useMemo(() => makeScreenStyles(colors), [colors]);
  const s = useMemo(() => makeGymMapStyles(colors), [colors]);
  const isFrozen = user?.status === "frozen";
  const [isRefreshing, setRefreshing] = useState(false);
  const [activeFloor, setActiveFloor] = useState<FacilityFloorId>("floor-1");
  const [selectedVenueMapId, setSelectedVenueMapId] = useState<string | null>(null);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { scrollY.value = event.contentOffset.y; }
  });

  const menuItems: FABMenuItem[] = useMemo(() => {
    if (isFrozen) return [];
    return [
      {
        label: "Chat with BrodigyAI",
        icon: MessageCircle,
        iconColor: colors.brand,
        iconBg: colors.brand + "22",
        onPress: () => {
          router.push({
            pathname: "/(tabs)/chatbot",
            params: { sessionId: "new", from: "facilities" }
          });
        }
      },
      {
        label: "Make Reservation",
        icon: CalendarPlus,
        iconColor: colors.textSecondary,
        iconBg: colors.textSecondary + "22",
        onPress: () => setReservationOpen(true)
      }
    ];
  }, [colors.brand, colors.textSecondary, isFrozen, router, setReservationOpen]);

  useFocusEffect(useCallback(() => {
    registerFAB({ screenIcon: Dumbbell, menuItems, scrollY, visible: !isFrozen });
    return () => unregisterFAB();
  }, [isFrozen, menuItems, registerFAB, scrollY, unregisterFAB]));

  const { data: venues = [], refetch } = useQuery({
    ...venuesQueryOptions(mobileApiClient, user?.id),
    enabled: isFocused && !!user?.id
  });

  const floorVenues = useMemo(() => buildFacilityFloorVenues(venues), [venues]);
  const activeFloorConfig = FACILITY_FLOOR_MAP[activeFloor];
  const activeFloorVenues = floorVenues[activeFloor];
  const venueZones = useMemo(() => activeFloorVenues.map(getVenuePresentation), [activeFloorVenues]);
  const activeBlueprint = FACILITY_BLUEPRINT_COPY[activeFloor];
  const activeVenue = useMemo(
      () => venueZones.find((venue) => venue.mapId === selectedVenueMapId) ?? null,
      [selectedVenueMapId, venueZones]
  );
  const nextMappedFloor = useMemo(
    () => FACILITY_FLOORS.find((floor) => floor.id !== activeFloor && floorVenues[floor.id].length > 0) ?? null,
    [activeFloor, floorVenues]
  );
  const floorSnapshot = useMemo(() => {
    const reservableCount = activeFloorVenues.filter((venue) => venue.isReservable).length;
    const supportCount = Math.max(activeFloorVenues.length - reservableCount, 0);
    const zoneCount = activeFloorVenues.length;
    const title =
      zoneCount === 0
        ? `${activeFloorConfig.label} is waiting for mapped zones`
        : `${activeFloorConfig.label} now maps ${zoneCount} live zone${zoneCount === 1 ? "" : "s"}`;
    const body =
      zoneCount === 0
        ? nextMappedFloor
          ? `${activeFloorConfig.emptySubtitle}. Switch to ${nextMappedFloor.label} to keep exploring the live layout.`
          : `${activeFloorConfig.emptySubtitle}. Staff can publish the next zone layout from the admin facilities editor.`
        : `${reservableCount} reservable zone${reservableCount === 1 ? "" : "s"} and ${supportCount} shared support area${supportCount === 1 ? "" : "s"} are laid out on the same persisted grid used by the admin floor map.`;

    return {
      body,
      reservableCount,
      supportCount,
      title,
      zoneCount
    };
  }, [activeFloorConfig.emptySubtitle, activeFloorConfig.label, activeFloorVenues, nextMappedFloor]);

  const screenStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }]
  }));

  useEffect(() => {
    if (selectedVenueMapId && !venueZones.some((venue) => venue.mapId === selectedVenueMapId)) {
      setSelectedVenueMapId(null);
    }
  }, [selectedVenueMapId, venueZones]);

  const doRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await invalidateVenueQueries(queryClient, user?.id);
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, refetch, user?.id]);

  return (
      <Animated.View style={[base.screen, !isFocused && { display: "none" }]}>
        <Animated.ScrollView
            style={[base.content, screenStyle]}
            contentContainerStyle={base.scrollContent}
            showsVerticalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
        >
          <View style={s.sectionHeader}>
            <View>
              <FitText style={s.sectionTitle}>Gym Facilities</FitText>
              <FitText style={s.sectionSubtitle}>{activeBlueprint.description}</FitText>
            </View>
            <FitButton
              onPress={() => void doRefresh()}
              variant="ghost"
              icon={RefreshCw}
              iconOnly
              disabled={isRefreshing}
              style={s.refreshBtn}
            />
          </View>
          <View style={s.floorToggleWrap}>
            <FitText style={s.floorToggleLabel}>LEVEL</FitText>
            <View style={s.floorToggleRow}>
              {FACILITY_FLOORS.map((floor) => (
                <FitButton
                  key={floor.id}
                  label={floor.label}
                  onPress={() => {
                    setActiveFloor(floor.id);
                    setSelectedVenueMapId(null);
                  }}
                  variant={activeFloor === floor.id ? "primary" : "ghost"}
                  style={s.floorToggleButton}
                  textStyle={s.floorToggleButtonText}
                />
              ))}
            </View>
          </View>
          <View style={s.floorSnapshotCard}>
            <View style={s.floorSnapshotHeader}>
              <View style={s.floorSnapshotTitleWrap}>
                <FitText style={s.floorSnapshotEyebrow}>{activeBlueprint.eyebrow}</FitText>
                <FitText style={s.floorSnapshotTitle}>{floorSnapshot.title}</FitText>
              </View>
              <FitText style={s.floorSnapshotFloorLabel}>{activeFloorConfig.label}</FitText>
            </View>
            <FitText style={s.floorSnapshotBody}>{floorSnapshot.body}</FitText>
            <View style={s.floorSnapshotMetrics}>
              <View style={s.floorSnapshotMetricCard}>
                <FitText style={s.floorSnapshotMetricValue}>{floorSnapshot.zoneCount}</FitText>
                <FitText style={s.floorSnapshotMetricLabel}>Mapped zones</FitText>
              </View>
              <View style={s.floorSnapshotMetricCard}>
                <FitText style={s.floorSnapshotMetricValue}>{floorSnapshot.reservableCount}</FitText>
                <FitText style={s.floorSnapshotMetricLabel}>Reservable</FitText>
              </View>
              <View style={s.floorSnapshotMetricCard}>
                <FitText style={s.floorSnapshotMetricValue}>{floorSnapshot.supportCount}</FitText>
                <FitText style={s.floorSnapshotMetricLabel}>Shared support</FitText>
              </View>
            </View>
          </View>
          <View style={s.mapCanvas}>
            <View style={s.mapBlueprintLayer}>
              <View style={s.mapBlueprintTint} />
              <View style={[s.mapBlueprintRouteHorizontal, { top: "18%" as never }]} />
              <View style={[s.mapBlueprintRouteHorizontal, { top: "72%" as never }]} />
              <View style={[s.mapBlueprintRouteVertical, { left: "22%" as never }]} />
              <View style={[s.mapBlueprintRouteVertical, { left: "78%" as never }]} />
              <View style={s.mapBlueprintCompass}>
                <FitText style={s.mapBlueprintCompassEyebrow}>{activeBlueprint.eyebrow}</FitText>
                <FitText style={s.mapBlueprintCompassLabel}>{activeBlueprint.routeLabel}</FitText>
                <FitText style={s.mapBlueprintCompassBody}>
                  Keep the highlighted path in view to stay oriented while scanning zones.
                </FitText>
              </View>
              {activeBlueprint.markers.map((marker) => (
                <View
                  key={`${activeFloor}-${marker.label}`}
                  style={[
                    s.mapBlueprintMarker,
                    marker.tone === "primary" ? s.mapBlueprintMarkerPrimary : s.mapBlueprintMarkerMuted,
                    {
                      height: `${marker.height}%` as never,
                      left: `${marker.left}%` as never,
                      top: `${marker.top}%` as never,
                      width: `${marker.width}%` as never
                    }
                  ]}
                >
                  <FitText style={s.mapBlueprintMarkerLabel}>{marker.label}</FitText>
                  <FitText style={s.mapBlueprintMarkerHint}>{marker.hint}</FitText>
                </View>
              ))}
            </View>
            {Array.from({ length: GRID_COLUMNS - 1 }).map((_, index) => (
                <View
                    key={`col-${index}`}
                    style={[
                      s.mapGridLine,
                      {
                        width: 1,
                        top: 0,
                        bottom: 0,
                        left: `${((index + 1) / GRID_COLUMNS) * 100}%` as never
                      }
                    ]}
                />
            ))}
            {Array.from({ length: GRID_ROWS - 1 }).map((_, index) => (
                <View
                    key={`row-${index}`}
                    style={[
                      s.mapGridLine,
                      {
                        height: 1,
                        left: 0,
                        right: 0,
                        top: `${((index + 1) / GRID_ROWS) * 100}%` as never
                      }
                    ]}
                />
            ))}
            {venueZones.length === 0 ? (
              <View style={s.mapEmptyState}>
                <FitText style={s.mapEmptyStateTitle}>{activeFloorConfig.emptyTitle}</FitText>
                <FitText style={s.mapEmptyStateBody}>
                  {nextMappedFloor
                    ? `This level has no published zones yet. Jump to ${nextMappedFloor.label} to keep navigating the live facility map.`
                    : "This level has no published zones yet. Refresh later or ask staff to publish the next floor layout."}
                </FitText>
                {nextMappedFloor ? (
                  <FitButton
                    label={`Open ${nextMappedFloor.label}`}
                    onPress={() => {
                      setActiveFloor(nextMappedFloor.id);
                      setSelectedVenueMapId(null);
                    }}
                    variant="primary"
                    style={s.mapEmptyStateAction}
                  />
                ) : null}
              </View>
            ) : (
              venueZones.map((venue) => {
                const Icon = getVenueIcon(venue.iconKey);
                const isSelected = selectedVenueMapId === venue.mapId;
                return (
                    <Pressable
                        key={venue.mapId ?? venue.id}
                        style={[
                          s.mapZone,
                          {
                            left: `${((venue.gridColumn - 1) / GRID_COLUMNS) * 100}%` as never,
                            top: `${((venue.gridRow - 1) / GRID_ROWS) * 100}%` as never,
                            width: `${(venue.gridWidth / GRID_COLUMNS) * 100}%` as never,
                            height: `${(venue.gridHeight / GRID_ROWS) * 100}%` as never,
                            borderColor: isSelected ? colors.brand : colors.brand + "66"
                          }
                        ]}
                        onPress={() => setSelectedVenueMapId(venue.mapId ?? venue.id)}
                    >
                      <View style={s.mapZoneBackdrop} />
                      <View style={s.mapZoneBadge}>
                        <Icon size={20} color={colors.brand} strokeWidth={2} />
                        <FitText style={s.mapZoneLabel} numberOfLines={2}>
                          {venue.name}
                        </FitText>
                        <FitText style={s.mapZoneMeta}>
                          {venue.isReservable ? `${venue.price}/${venue.unit}` : "Facility zone"}
                        </FitText>
                      </View>
                    </Pressable>
                );
              })
            )}
          </View>
          <FitSection heading="Legend" cardStyle={s.legendCard}>
            {venueZones.length === 0 ? (
              <FitText style={s.mapLegendEmpty}>
                No venue markers are published on this level yet. The blueprint layer stays visible so members can still understand the floor orientation.
              </FitText>
            ) : (
              <View style={s.mapLegendInner}>
                {venueZones.map((venue) => {
                  const Icon = getVenueIcon(venue.iconKey);
                  return (
                      <View key={venue.mapId ?? venue.id} style={s.mapLegendItem}>
                        <Icon size={16} color={colors.brand} strokeWidth={2} />
                        <FitText style={s.mapLegendLabel}>{venue.name}</FitText>
                      </View>
                  );
                })}
              </View>
            )}
          </FitSection>
          <FitText style={s.mapTip}>
            Tap any venue zone to view details for {activeFloorConfig.label.toLowerCase()}. The blueprint layer is only an orientation aid, so live venue cards always stay in front.
          </FitText>
        </Animated.ScrollView>
        <DetailsModal
            isVisible={activeVenue !== null}
            venue={activeVenue}
            onClose={() => setSelectedVenueMapId(null)}
        />
      </Animated.View>
  );
}
