import { useState, useCallback, useEffect, useMemo } from "react";
import { Image, Pressable, View } from "react-native";
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useFocusEffect, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsFocused } from "@react-navigation/native";
import { Dumbbell, RefreshCw, MessageCircle, CalendarPlus } from "lucide-react-native";
import {
  gymLayoutEquipmentQueryOptions,
  gymLayoutFloorPlanMediaQueryOptions,
  invalidateGymLayoutQueries,
  invalidateVenueQueries,
  venuesQueryOptions
} from "@fittrack/query";
import {
  FACILITY_FLOORS,
  FACILITY_FLOOR_MAP,
  GYM_LAYOUT_GRID_COLUMNS,
  GYM_LAYOUT_GRID_ROWS,
  buildFacilityFloorVenues,
  isEquipmentInsideVenue,
  resolveEquipmentGridPlacement,
  type FacilityFloorId
} from "@fittrack/types";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { type FABMenuItem, useFABState } from "@/contexts/FABStateContext";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { makeScreenStyles, makeGymMapStyles } from "@/styles/shared/ScreenStyles";
import { buildRenderableAssetUrl } from "@fittrack/utils";
import { MOBILE_API_BASE_URL, mobileApiClient } from "@/lib/api-client";
import { getFacilityStatusColor, getFacilityStatusLabel } from "@/utils/facilityStatus";
import { getVenuePresentation } from "@/utils/venueBookings";
import { getVenueIcon } from "@/utils/venueMap";

import FitButton from "@/components/fit/FitButton";
import { FitText } from "@/components/fit/FitText";
import FitSection from "@/components/fit/FitSection";
import DetailsModal from "@/components/modals/booking/DetailsModal";
import EquipmentDetailsModal from "@/components/modals/booking/EquipmentDetailsModal";

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
      { hint: "Built-in circulation node", label: "Path / Walkway", left: 31, top: 12, tone: "primary", width: 29, height: 28 },
      { hint: "Court-side wayfinding", label: "Exit", left: 63, top: 12, tone: "muted", width: 27, height: 34 }
    ]
  },
  "floor-2": {
    description: "A tighter training annex with coaching and ring-side movement kept readable through one central spine.",
    eyebrow: "Focused Zone",
    routeLabel: "Coach access lane",
    markers: [
      { hint: "Warm-up and prep", label: "Prep", left: 12, top: 18, tone: "muted", width: 22, height: 22 },
      { hint: "Built-in circulation node", label: "Path / Walkway", left: 39, top: 24, tone: "primary", width: 32, height: 28 },
      { hint: "Support edge", label: "Recovery", left: 72, top: 18, tone: "muted", width: 16, height: 22 }
    ]
  },
  "floor-3": {
    description: "The studio floor stays calm and open, with the blueprint layer acting as a soft guide instead of a busy architectural diagram.",
    eyebrow: "Studio Flow",
    routeLabel: "Quiet movement lane",
    markers: [
      { hint: "Light prep zone", label: "Prep", left: 10, top: 18, tone: "muted", width: 18, height: 18 },
      { hint: "Built-in circulation node", label: "Path / Walkway", left: 31, top: 18, tone: "primary", width: 40, height: 40 },
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
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [floorImageFailed, setFloorImageFailed] = useState(false);

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

  const { data: venues = [], refetch, isError: venuesLoadFailed, isLoading: venuesLoading } = useQuery({
    ...venuesQueryOptions(mobileApiClient, user?.id),
    enabled: isFocused && !!user?.id
  });
  const { data: liveEquipment = [], isError: equipmentLoadFailed } = useQuery({
    ...gymLayoutEquipmentQueryOptions(mobileApiClient),
    enabled: isFocused
  });
  const { data: floorPlanMedia = [] } = useQuery({
    ...gymLayoutFloorPlanMediaQueryOptions(mobileApiClient),
    enabled: isFocused
  });

  const floorVenues = useMemo(() => buildFacilityFloorVenues(venues), [venues]);
  const activeFloorConfig = FACILITY_FLOOR_MAP[activeFloor];
  const activeFloorVenues = floorVenues[activeFloor];
  const venueZones = useMemo(() => activeFloorVenues.map(getVenuePresentation), [activeFloorVenues]);
  const activeFloorEquipment = useMemo(
    () => liveEquipment.filter((item) => item.isActive && item.floorId === activeFloor),
    [activeFloor, liveEquipment]
  );
  const equipmentNodes = useMemo(
    () =>
      activeFloorEquipment.flatMap((item) => {
        const explicitVenue = item.venueId
          ? activeFloorVenues.find(
              (venue) => String(venue.sourceVenueId ?? venue.id) === String(item.venueId)
            )
          : null;
        const containingVenue = activeFloorVenues.find((venue) =>
          isEquipmentInsideVenue(item, venue)
        );
        const venue = explicitVenue ?? containingVenue;
        if (!venue) return [];

        const placement = resolveEquipmentGridPlacement(item);
        const left = venue.gridColumn ?? 1;
        const top = venue.gridRow ?? 1;
        const right = left + (venue.gridWidth ?? 1) - 1;
        const bottom = top + (venue.gridHeight ?? 1) - 1;

        return [{
          item,
          venue,
          gridColumn: Math.max(left, Math.min(right, placement.gridColumn)),
          gridRow: Math.max(top, Math.min(bottom, placement.gridRow))
        }];
      }),
    [activeFloorEquipment, activeFloorVenues]
  );
  const activeFloorImageUrl = useMemo(() => {
    const imageUrl = floorPlanMedia.find((media) => media.floorId === activeFloor)?.imageUrl;
    return buildRenderableAssetUrl({ apiBaseUrl: MOBILE_API_BASE_URL, assetUrl: imageUrl });
  }, [activeFloor, floorPlanMedia]);
  const equipmentCountByVenue = useMemo(
    () =>
      equipmentNodes.reduce<Record<string, number>>((counts, node) => {
        counts[node.venue.mapId] = (counts[node.venue.mapId] ?? 0) + 1;
        return counts;
      }, {}),
    [equipmentNodes]
  );
  const venueZoneStacks = useMemo(() => {
    const groups = new Map<string, string[]>();

    venueZones.forEach((venue) => {
      const venueId = venue.mapId ?? venue.id;
      const geometryKey = [
        venue.gridColumn,
        venue.gridRow,
        venue.gridWidth,
        venue.gridHeight
      ].join(":");
      groups.set(geometryKey, [...(groups.get(geometryKey) ?? []), venueId]);
    });

    const stacks = new Map<string, { count: number; index: number }>();
    groups.forEach((venueIds) => {
      venueIds.forEach((venueId, index) => {
        stacks.set(venueId, { count: venueIds.length, index });
      });
    });

    return stacks;
  }, [venueZones]);
  const activeBlueprint = FACILITY_BLUEPRINT_COPY[activeFloor];
  const activeVenue = useMemo(
      () => venueZones.find((venue) => (venue.mapId ?? venue.id) === selectedVenueMapId) ?? null,
      [selectedVenueMapId, venueZones]
  );
  const selectedEquipmentNode = useMemo(
    () => equipmentNodes.find((node) => node.item.id === selectedEquipmentId) ?? null,
    [equipmentNodes, selectedEquipmentId]
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
    if (selectedVenueMapId && !venueZones.some((venue) => (venue.mapId ?? venue.id) === selectedVenueMapId)) {
      setSelectedVenueMapId(null);
    }
    if (selectedEquipmentId && !equipmentNodes.some((node) => node.item.id === selectedEquipmentId)) {
      setSelectedEquipmentId(null);
    }
  }, [equipmentNodes, selectedEquipmentId, selectedVenueMapId, venueZones]);

  useEffect(() => {
    setFloorImageFailed(false);
  }, [activeFloorImageUrl]);

  const doRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        invalidateGymLayoutQueries(queryClient),
        invalidateVenueQueries(queryClient, user?.id),
        refetch()
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, refetch, user?.id]);

  const handleReserveVenue = useCallback(() => {
    setSelectedVenueMapId(null);
    setSelectedEquipmentId(null);
    if (!isFrozen) setReservationOpen(true);
  }, [isFrozen, setReservationOpen]);

  const emptyMapTitle = venuesLoading
    ? "Loading live layout"
    : venuesLoadFailed
      ? "Live layout unavailable"
      : "No mapped zones published";
  const emptyMapBody = venuesLoadFailed
    ? "The live facility layout could not be loaded. Refresh to try again."
    : nextMappedFloor
      ? `This level has no published zones yet. Jump to ${nextMappedFloor.label} to keep navigating the live facility map.`
      : "This level has no published zones yet. Staff can publish the next floor layout from the admin facilities editor.";

  return (
      <Animated.View style={[base.screen, !isFocused && { display: "none" }]}>
        <Animated.ScrollView
            style={[base.content, screenStyle]}
            contentContainerStyle={base.scrollContent}
            showsVerticalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
        >
          <View style={s.floorToggleWrap}>
            <View style={s.floorToggleHeader}>
              <FitText style={s.floorToggleLabel}>LEVEL</FitText>
              <FitButton
                accessibilityLabel="Refresh facilities map"
                onPress={() => void doRefresh()}
                variant="ghost"
                icon={RefreshCw}
                iconOnly
                disabled={isRefreshing}
                style={s.refreshBtn}
              />
            </View>
            <View style={s.floorToggleRow}>
              {FACILITY_FLOORS.map((floor) => (
                <FitButton
                  key={floor.id}
                  label={floor.label}
                  onPress={() => {
                    setActiveFloor(floor.id);
                    setSelectedVenueMapId(null);
                    setSelectedEquipmentId(null);
                  }}
                  variant={activeFloor === floor.id ? "primary" : "ghost"}
                  style={s.floorToggleButton}
                  textStyle={s.floorToggleButtonText}
                />
              ))}
            </View>
          </View>
          <View style={s.mapCanvas}>
            <View style={s.mapBlueprintLayer}>
              {activeFloorImageUrl && !floorImageFailed ? (
                <Image
                  accessibilityLabel={`${activeFloorConfig.label} floor plan`}
                  source={{ uri: activeFloorImageUrl }}
                  resizeMode="cover"
                  onError={() => setFloorImageFailed(true)}
                  style={s.mapFloorPlanImage}
                />
              ) : null}
              <View style={s.mapBlueprintTint} />
              <View style={[s.mapBlueprintRouteHorizontal, { top: "18%" as never }]} />
              <View style={[s.mapBlueprintRouteHorizontal, { top: "72%" as never }]} />
              <View style={[s.mapBlueprintRouteVertical, { left: "22%" as never }]} />
              <View style={[s.mapBlueprintRouteVertical, { left: "78%" as never }]} />
              <View style={s.mapBlueprintCompass}>
                <FitText style={s.mapBlueprintCompassEyebrow}>Map guide</FitText>
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
                <FitText style={s.mapEmptyStateTitle}>{emptyMapTitle}</FitText>
                <FitText style={s.mapEmptyStateBody}>
                  {emptyMapBody}
                </FitText>
                {nextMappedFloor && !venuesLoadFailed ? (
                  <FitButton
                    label={`Open ${nextMappedFloor.label}`}
                    onPress={() => {
                      setActiveFloor(nextMappedFloor.id);
                      setSelectedVenueMapId(null);
                      setSelectedEquipmentId(null);
                    }}
                    variant="primary"
                    style={s.mapEmptyStateAction}
                  />
                ) : null}
              </View>
            ) : (
              venueZones.map((venue) => {
                const Icon = getVenueIcon(venue.iconKey);
                const venueId = venue.mapId ?? venue.id;
                const isSelected = selectedVenueMapId === venueId;
                const statusColor = getFacilityStatusColor(venue.status, colors);
                const statusLabel = getFacilityStatusLabel(venue.status);
                const zoneStack = venueZoneStacks.get(venueId) ?? { count: 1, index: 0 };
                const stackedGridHeight = venue.gridHeight / zoneStack.count;
                const stackedGridRow = venue.gridRow + stackedGridHeight * zoneStack.index;
                const venueAccessLabel =
                    zoneStack.count > 1
                        ? `Open ${venue.name} details, zone ${zoneStack.index + 1} of ${zoneStack.count}`
                        : `Open ${venue.name} details`;
                return (
                    <Pressable
                        key={venueId}
                        accessibilityLabel={venueAccessLabel}
                        accessibilityRole="button"
                        hitSlop={6}
                        style={[
                          s.mapZone,
                          {
                            left: `${((venue.gridColumn - 1) / GRID_COLUMNS) * 100}%` as never,
                            top: `${((stackedGridRow - 1) / GRID_ROWS) * 100}%` as never,
                            width: `${(venue.gridWidth / GRID_COLUMNS) * 100}%` as never,
                            height: `${(stackedGridHeight / GRID_ROWS) * 100}%` as never,
                            borderColor: isSelected ? colors.brand : statusColor,
                            backgroundColor: statusColor + "12"
                          }
                        ]}
                        onPress={() => {
                          setSelectedVenueMapId(venueId);
                          setSelectedEquipmentId(null);
                        }}
                    >
                      <View style={[s.mapZoneBackdrop, { backgroundColor: statusColor + "12" }]} />
                      <View style={s.mapZoneBadge}>
                        <Icon size={20} color={colors.brand} strokeWidth={2} />
                        <FitText style={s.mapZoneLabel} numberOfLines={2}>
                          {venue.name}
                        </FitText>
                        <View style={s.mapZoneStatusRow}>
                          <View style={[s.mapStatusDot, { backgroundColor: statusColor }]} />
                          <FitText style={[s.mapZoneMeta, { color: statusColor }]} numberOfLines={1}>
                            {statusLabel}
                          </FitText>
                        </View>
                        <FitText style={s.mapZoneMeta} numberOfLines={1}>
                          {equipmentCountByVenue[venueId]
                            ? `${equipmentCountByVenue[venueId]} mapped unit${equipmentCountByVenue[venueId] === 1 ? "" : "s"}`
                            : venue.isReservable ? `${venue.price}/${venue.unit}` : "Facility zone"}
                        </FitText>
                      </View>
                    </Pressable>
                );
              })
            )}
            {equipmentNodes.map(({ item, venue, gridColumn, gridRow }) => {
              const statusColor = getFacilityStatusColor(item.status, colors);
              const isSelected = selectedEquipmentId === item.id;
              const Icon = getVenueIcon(item.iconKey);
              return (
                <Pressable
                  key={item.id}
                  accessibilityLabel={`Open ${item.name} details, ${getFacilityStatusLabel(item.status)}, in ${venue.name}`}
                  accessibilityRole="button"
                  hitSlop={5}
                  style={[
                    s.mapEquipmentNode,
                    {
                      left: `${((gridColumn - 1) / GRID_COLUMNS) * 100}%` as never,
                      top: `${((gridRow - 1) / GRID_ROWS) * 100}%` as never,
                      width: `${(1 / GRID_COLUMNS) * 100}%` as never,
                      height: `${(1 / GRID_ROWS) * 100}%` as never,
                      borderColor: isSelected ? colors.brand : statusColor
                    }
                  ]}
                  onPress={() => {
                    setSelectedEquipmentId(item.id);
                    setSelectedVenueMapId(null);
                  }}
                >
                  <Icon size={14} color={statusColor} strokeWidth={2.2} />
                  <FitText style={[s.mapEquipmentLabel, { color: statusColor }]} numberOfLines={1}>
                    {item.name}
                  </FitText>
                </Pressable>
              );
            })}
          </View>
          {equipmentLoadFailed ? (
            <FitText style={[s.mapLegendEmpty, { color: colors.danger, marginBottom: 12 }]}>
              Equipment placement is temporarily unavailable. Venue layout remains visible from the last loaded source.
            </FitText>
          ) : null}
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
          <View style={s.floorSnapshotCard}>
            <View style={s.floorSnapshotHeader}>
              <View style={s.floorSnapshotTitleWrap}>
                <FitText style={s.floorSnapshotEyebrow}>{activeBlueprint.eyebrow}</FitText>
                <FitText style={s.floorSnapshotTitle}>{floorSnapshot.title}</FitText>
              </View>
              <FitText style={s.floorSnapshotFloorLabel}>{activeFloorConfig.label}</FitText>
            </View>
            <FitText style={s.floorSnapshotBody}>{activeBlueprint.description}</FitText>
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
          <FitText style={s.mapTip}>
            Tap a venue zone or mapped equipment node to view its live status and details. The blueprint layer is only an orientation aid, so persisted records always stay in front.
          </FitText>
        </Animated.ScrollView>
        <DetailsModal
            isVisible={activeVenue !== null}
            venue={activeVenue}
            onClose={() => setSelectedVenueMapId(null)}
            onReserve={!isFrozen ? handleReserveVenue : undefined}
        />
        <EquipmentDetailsModal
            equipment={selectedEquipmentNode?.item ?? null}
            isVisible={selectedEquipmentNode !== null}
            onClose={() => setSelectedEquipmentId(null)}
            venueName={selectedEquipmentNode?.venue.name}
        />
      </Animated.View>
  );
}
