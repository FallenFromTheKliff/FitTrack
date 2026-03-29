import { useState, useCallback, useMemo } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useFocusEffect, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dumbbell, RefreshCw, MessageCircle, CalendarPlus } from "lucide-react-native";
import { invalidateVenueQueries, venuesQueryOptions } from "@fittrack/query";
import { FACILITY_FLOORS, FACILITY_FLOOR_MAP, buildFacilityFloorVenues, type FacilityFloorId } from "@fittrack/types";

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

const GRID_COLUMNS = 14;
const GRID_ROWS = 10;

export default function FacilitiesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
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

  const { data: venues = [], refetch } = useQuery(venuesQueryOptions(mobileApiClient, user?.id));

  const floorVenues = useMemo(() => buildFacilityFloorVenues(venues), [venues]);
  const activeFloorConfig = FACILITY_FLOOR_MAP[activeFloor];
  const activeFloorVenues = floorVenues[activeFloor];
  const venueZones = useMemo(() => activeFloorVenues.map(getVenuePresentation), [activeFloorVenues]);
  const activeVenue = useMemo(
      () => venueZones.find((venue) => venue.mapId === selectedVenueMapId) ?? null,
      [selectedVenueMapId, venueZones]
  );

  const screenStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }]
  }));

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
      <Animated.View style={base.screen}>
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
              <FitText style={s.sectionSubtitle}>{activeFloorConfig.subtitle}</FitText>
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
          <View style={s.mapCanvas}>
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
            {venueZones.map((venue) => {
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
            })}
          </View>
          <FitSection heading="Legend" cardStyle={s.legendCard}>
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
          </FitSection>
          <FitText style={s.mapTip}>Tap any venue zone to view details for {activeFloorConfig.label.toLowerCase()}.</FitText>
        </Animated.ScrollView>
        <DetailsModal
            isVisible={activeVenue !== null}
            venue={activeVenue}
            onClose={() => setSelectedVenueMapId(null)}
        />
      </Animated.View>
  );
}
