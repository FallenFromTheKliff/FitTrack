import { useState, useCallback, useMemo } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useFocusEffect, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dumbbell, RefreshCw, MessageCircle, CalendarPlus } from "lucide-react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { type FABMenuItem, useFABState } from "@/contexts/FABStateContext";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { makeScreenStyles, makeGymMapStyles } from "@/styles/shared/ScreenStyles";
import { mobileApi } from "@/lib/api";
import { getVenuePresentation, type VenueRecord } from "@/utils/venueBookings";
import { getVenueIcon } from "@/utils/venueMap";

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
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);

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
  }, [colors.brand, colors.textSecondary, router, setReservationOpen]);

  useFocusEffect(useCallback(() => {
    registerFAB({ screenIcon: Dumbbell, menuItems, scrollY, visible: !isFrozen });
    return () => unregisterFAB();
  }, [menuItems, registerFAB, scrollY, unregisterFAB]));

  const { data: venues = [], refetch } = useQuery<VenueRecord[]>({
    queryKey: ["venues"],
    queryFn: async () => {
      const { data } = await mobileApi.get<VenueRecord[]>("/venues?active=true");
      return data;
    }
  });

  const venueZones = useMemo(() => venues.map(getVenuePresentation), [venues]);
  const activeVenue = useMemo(
      () => venueZones.find((venue) => venue.id === selectedVenueId) ?? null,
      [selectedVenueId, venueZones]
  );

  const screenStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }]
  }));

  const doRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["venues"] });
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, refetch]);

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
              <FitText style={s.sectionSubtitle}>Real-time venue availability</FitText>
            </View>
            <Pressable onPress={() => void doRefresh()} style={s.refreshBtn}>
              <RefreshCw
                  size={20}
                  color={isRefreshing ? colors.textMuted : colors.brand}
                  strokeWidth={2}
              />
            </Pressable>
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
              return (
                  <Pressable
                      key={venue.id}
                      style={[
                        s.mapZone,
                        {
                          left: `${((venue.gridColumn - 1) / GRID_COLUMNS) * 100}%` as never,
                          top: `${((venue.gridRow - 1) / GRID_ROWS) * 100}%` as never,
                          width: `${(venue.gridWidth / GRID_COLUMNS) * 100}%` as never,
                          height: `${(venue.gridHeight / GRID_ROWS) * 100}%` as never
                        }
                      ]}
                      onPress={() => setSelectedVenueId(venue.id)}
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
                    <View key={venue.id} style={s.mapLegendItem}>
                      <Icon size={16} color={colors.brand} strokeWidth={2} />
                      <FitText style={s.mapLegendLabel}>{venue.name}</FitText>
                    </View>
                );
              })}
            </View>
          </FitSection>
          <FitText style={s.mapTip}>Tap any venue zone to view details about that facility.</FitText>
        </Animated.ScrollView>
        <DetailsModal
            isVisible={activeVenue !== null}
            venue={activeVenue}
            onClose={() => setSelectedVenueId(null)}
        />
      </Animated.View>
  );
}