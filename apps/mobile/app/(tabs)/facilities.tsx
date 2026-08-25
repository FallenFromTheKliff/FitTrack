import { useCallback, useMemo, useState } from "react";
import { RefreshControl, View } from "react-native";
import Animated, { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { useFocusEffect, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useIsFocused } from "@react-navigation/native";
import { CalendarPlus, Dumbbell, MessageCircle } from "lucide-react-native";
import { facilityMapSnapshotQueryOptions } from "@fittrack/query";
import { FACILITY_FLOORS, FACILITY_FLOOR_MAP, type FacilityFloorId } from "@fittrack/types";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { type FABMenuItem, useFABState } from "@/contexts/FABStateContext";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { makeScreenStyles, makeGymMapStyles } from "@/styles/shared/ScreenStyles";
import { mobileApiClient } from "@/lib/api-client";
import { getVenuePresentation } from "@/utils/venueBookings";
import { FacilityMapViewport } from "@/components/facilities/FacilityMapViewport";
import FitButton from "@/components/fit/FitButton";
import { FitText } from "@/components/fit/FitText";
import FitSection from "@/components/fit/FitSection";
import DetailsModal from "@/components/modals/booking/DetailsModal";

export default function FacilitiesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isFocused = useIsFocused();
  const { colors } = useTheme();
  const { registerFAB, unregisterFAB, setReservationOpen } = useFABState();
  const { opacity, translateY } = usePassageAnim({ mode: "focus" });
  const base = useMemo(() => makeScreenStyles(colors), [colors]);
  const s = useMemo(() => makeGymMapStyles(colors), [colors]);
  const isFrozen = user?.status === "frozen";
  const [activeFloor, setActiveFloor] = useState<FacilityFloorId>("floor-1");
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [mapGestureActive, setMapGestureActive] = useState(false);
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (event) => { scrollY.value = event.contentOffset.y; } });
  const snapshotQuery = useQuery({
    ...facilityMapSnapshotQueryOptions(mobileApiClient),
    enabled: isFocused,
    refetchInterval: isFocused ? 20_000 : false,
  });
  const refetchSnapshot = snapshotQuery.refetch;
  const floor = snapshotQuery.data?.floors.find((item) => item.floorId === activeFloor) ?? null;
  const selectedRegion = floor?.regions.find((region) => region.id === selectedRegionId) ?? null;
  const selectedVenue = useMemo(() => selectedRegion ? getVenuePresentation({
    id: selectedRegion.sourceVenueId,
    slug: selectedRegion.id,
    name: selectedRegion.name,
    description: selectedRegion.description,
    capacity: selectedRegion.capacity,
    hourlyRate: selectedRegion.hourlyRate,
    minimumHours: selectedRegion.minimumHours,
    iconKey: selectedRegion.iconKey,
    imageUrl: selectedRegion.imageUrl,
    floorId: selectedRegion.floorId,
    gridColumn: selectedRegion.gridColumn,
    gridRow: selectedRegion.gridRow,
    gridWidth: selectedRegion.gridWidth,
    gridHeight: selectedRegion.gridHeight,
    isReservable: selectedRegion.isReservable,
    status: selectedRegion.status,
  }) : null, [selectedRegion]);

  const menuItems: FABMenuItem[] = useMemo(() => isFrozen ? [] : [
    {
      label: "Chat with BrodigyAI", icon: MessageCircle,
      iconColor: colors.brand, iconBg: colors.brand + "22",
      onPress: () => router.push({ pathname: "/(tabs)/chatbot", params: { sessionId: "new", from: "facilities" } }),
    },
    {
      label: "Make Reservation", icon: CalendarPlus,
      iconColor: colors.textSecondary, iconBg: colors.textSecondary + "22",
      onPress: () => setReservationOpen(true),
    },
  ], [colors, isFrozen, router, setReservationOpen]);
  useFocusEffect(useCallback(() => {
    registerFAB({ screenIcon: Dumbbell, menuItems, scrollY, visible: !isFrozen });
    void refetchSnapshot();
    return () => unregisterFAB();
  }, [isFrozen, menuItems, refetchSnapshot, registerFAB, scrollY, unregisterFAB]));
  const screenStyle = useMemo(() => ({ opacity, transform: [{ translateY }] }), [opacity, translateY]);

  return (
    <Animated.View style={[base.screen, !isFocused && { display: "none" }]}>
      <Animated.ScrollView style={[base.content, screenStyle]} contentContainerStyle={base.scrollContent}
        onScroll={scrollHandler} scrollEventThrottle={16} scrollEnabled={!mapGestureActive}
        refreshControl={<RefreshControl refreshing={snapshotQuery.isRefetching} onRefresh={() => void refetchSnapshot()} />}>
        <View style={s.floorToggleWrap}>
          <FitText style={s.floorToggleLabel}>LEVEL</FitText>
          <View style={s.floorToggleRow}>{FACILITY_FLOORS.map((candidate) => (
            <FitButton key={candidate.id} label={candidate.label}
              variant={candidate.id === activeFloor ? "primary" : "ghost"}
              onPress={() => { setActiveFloor(candidate.id); setSelectedRegionId(null); }}
              style={s.floorToggleButton} textStyle={s.floorToggleButtonText} />
          ))}</View>
        </View>
        {floor ? (
          <FacilityMapViewport key={floor.floorId} floor={floor}
            selectedRegionId={selectedRegionId}
            onGestureActiveChange={setMapGestureActive}
            onSelectRegion={(region) => setSelectedRegionId(region.id)} />
        ) : (
          <View style={s.mapCanvas}><FitText style={s.mapEmptyStateTitle}>
            {snapshotQuery.isError ? "Facility map unavailable" : "Loading published facility map"}
          </FitText></View>
        )}
        <FitSection heading="Legend" cardStyle={s.legendCard}>
          <FitText style={s.mapLegendEmpty}>
            {floor ? `${floor.regions.length} published zones · ${floor.equipment.length} equipment nodes · ${FACILITY_FLOOR_MAP[activeFloor].label}` : "Waiting for the published snapshot."}
          </FitText>
        </FitSection>
      </Animated.ScrollView>
      <DetailsModal isVisible={selectedVenue !== null} venue={selectedVenue}
        onClose={() => setSelectedRegionId(null)}
        onReserve={!isFrozen && selectedRegion?.isBookable ? () => {
          setSelectedRegionId(null);
          setReservationOpen({ isOpen: true, preselectedVenueId: selectedRegion.sourceVenueId });
        } : undefined} />
    </Animated.View>
  );
}
