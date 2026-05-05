import { StyleSheet } from "react-native";

import type { ThemeColors } from "@fittrack/types";
import { R } from "@fittrack/ui/tokens";

export function makeScreenStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.base },
    content: { flex: 1 },
    scrollContent: { flexGrow: 1, padding: 20, paddingBottom: 120 }
  });
}

export function makeSettingsStyles(colors: ThemeColors) {
  return StyleSheet.create({
    footer: { alignItems: "center", gap: 4, paddingTop: 8 },
    footerText: { fontSize: 13, color: colors.textMuted }
  });
}

export function makeProfileStyles(colors: ThemeColors) {
  return StyleSheet.create({
    profileBanner: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 24,
      gap: 16,
      backgroundColor: colors.brand
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: R.xl,
      overflow: "hidden",
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.3)",
      backgroundColor: colors.brandLight,
      alignItems: "center",
      justifyContent: "center"
    },
    avatarInitials: { fontSize: 24, fontWeight: "700", color: colors.brand },
    profileInfo: { flex: 1, gap: 2 },
    profileName: { fontSize: 20, fontWeight: "700", color: colors.onBrand },
    profileEmail: { fontSize: 14, color: colors.onBrand, opacity: 0.8 },
    profileMeta: { fontSize: 13, color: colors.onBrand, opacity: 0.65, marginTop: 2 },
    statsRow: { flexDirection: "row", alignItems: "stretch" },
    statDivider: { width: 1, backgroundColor: colors.border },
    terminateBtn: { marginTop: 4 }
  });
}

export function makeHomeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    greeting: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
    greetingName: { fontSize: 23, fontWeight: "700", color: colors.textPrimary },
    greetingDate: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
    statsOuter: { paddingHorizontal: 20, marginBottom: 24, gap: 10 },
    statsGrid: { flexDirection: "row", gap: 10 },
    statsCol: { flex: 1, gap: 10 },
    caloriesCard: {
      backgroundColor: colors.brand,
      borderRadius: R.xl,
      padding: 16,
      justifyContent: "flex-end",
      flex: 1
    },
    caloriesLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.onBrand,
      opacity: 0.7,
      letterSpacing: 0.5,
      marginBottom: 6
    },
    caloriesValue: { fontSize: 36, fontWeight: "700", color: colors.onBrand, lineHeight: 40 },
    caloriesGoal: { fontSize: 13, color: colors.onBrand, opacity: 0.65, marginTop: 4 },
    statCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: R.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      justifyContent: "space-between"
    },
    statCardLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "500", letterSpacing: 0.3 },
    statCardValue: { fontSize: 28, fontWeight: "700", color: colors.textPrimary, marginTop: 4 },
    statCardSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    sectionWrap: { paddingHorizontal: 20, marginBottom: 6 },
    sectionViewAll: { alignItems: "flex-end", marginTop: 4 },
    quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    quickCard: {
      width: "47.5%",
      backgroundColor: colors.surface,
      borderRadius: R.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 10
    },
    quickIconBox: {
      width: 44,
      height: 44,
      borderRadius: R.lg,
      alignItems: "center",
      justifyContent: "center"
    },
    quickLabel: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
    quickSub: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
    goalRow: { paddingVertical: 12, paddingHorizontal: 16, gap: 6 },
    goalRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    goalLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    goalLabel: { fontSize: 14, color: colors.textSecondary },
    goalValue: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
    goalTrack: { height: 5, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden" },
    goalFill: { height: 5, borderRadius: 3 },
    badgeBanner: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: R.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 14
    },
    badgeIconBox: {
      width: 46,
      height: 46,
      borderRadius: R.lg,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.brand + "22"
    },
    badgeBannerTitle: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
    badgeBannerBody: { fontSize: 13, color: colors.textMuted, marginTop: 2, lineHeight: 18 }
  });
}

export function makeBookingsScreenStyles(colors: ThemeColors) {
  return StyleSheet.create({
    searchAnimWrap: { zIndex: 100, overflow: "visible" },
    searchWrap: {
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 4,
      zIndex: 100,
      overflow: "visible"
    },
    searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    searchFieldWrap: { flex: 1 },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: R.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      height: 46
    },
    searchInput: { flex: 1, fontSize: 15, paddingVertical: 0, paddingHorizontal: 0 },
    searchClear: { marginRight: 6 },
    filterBtn: { paddingLeft: 10, paddingVertical: 6 },
    emptyState: { alignItems: "center", paddingTop: 60, gap: 10 },
    emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.textSecondary },
    emptyHint: { fontSize: 13, color: colors.textMuted },
    group: { marginBottom: 24 },
    groupDivider: { height: 1, marginBottom: 10 },
    groupLabel: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.8,
      color: colors.textMuted,
      marginBottom: 8,
      paddingHorizontal: 2
    },
    groupCards: {
      backgroundColor: colors.surface,
      borderRadius: R.xl,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden"
    },
    cardRow: { flexDirection: "row", alignItems: "center" },
    checkbox: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
      marginLeft: 14,
      alignItems: "center",
      justifyContent: "center"
    },
    checkboxSelected: { backgroundColor: colors.danger, borderColor: colors.danger },
    cardWrap: { flex: 1, borderRadius: 0, overflow: "hidden" },
    selectionFooter: {
      flexDirection: "row",
      gap: 10,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.base
    }
  });
}

export function makeGymMapStyles(colors: ThemeColors) {
  return StyleSheet.create({
    sectionHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: 16
    },
    sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
    sectionSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    refreshBtn: { width: 40, height: 40, paddingHorizontal: 0 },
    floorToggleWrap: {
      gap: 10,
      padding: 10,
      borderRadius: R.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
      marginBottom: 16
    },
    floorToggleLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.8,
      color: colors.textMuted
    },
    floorToggleRow: {
      flexDirection: "row",
      gap: 8
    },
    floorToggleButton: {
      flex: 1,
      minHeight: 40
    },
    floorToggleButtonText: {
      fontSize: 12,
      fontWeight: "700"
    },
    floorSnapshotCard: {
      gap: 12,
      padding: 14,
      borderRadius: R.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginBottom: 16
    },
    floorSnapshotHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12
    },
    floorSnapshotTitleWrap: {
      flex: 1,
      gap: 4
    },
    floorSnapshotEyebrow: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.8,
      color: colors.brand
    },
    floorSnapshotTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary
    },
    floorSnapshotFloorLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textMuted,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.brand + "14",
      overflow: "hidden"
    },
    floorSnapshotBody: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 19
    },
    floorSnapshotMetrics: {
      flexDirection: "row",
      gap: 10
    },
    floorSnapshotMetricCard: {
      flex: 1,
      gap: 4,
      padding: 12,
      borderRadius: R.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised
    },
    floorSnapshotMetricValue: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.textPrimary
    },
    floorSnapshotMetricLabel: {
      fontSize: 12,
      color: colors.textMuted
    },
    mapCanvas: {
      height: 480,
      position: "relative" as const,
      borderRadius: R.xl,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
      overflow: "hidden",
      marginBottom: 16
    },
    mapBlueprintLayer: {
      ...StyleSheet.absoluteFillObject,
      pointerEvents: "none" as const
    },
    mapBlueprintTint: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.brand + "0A"
    },
    mapBlueprintRouteHorizontal: {
      position: "absolute" as const,
      left: "8%" as const,
      right: "8%" as const,
      height: 2,
      borderRadius: 999,
      backgroundColor: colors.brand + "26"
    },
    mapBlueprintRouteVertical: {
      position: "absolute" as const,
      top: "12%" as const,
      bottom: "12%" as const,
      width: 2,
      borderRadius: 999,
      backgroundColor: colors.brand + "22"
    },
    mapBlueprintCompass: {
      position: "absolute" as const,
      top: 14,
      right: 14,
      width: 148,
      gap: 4,
      padding: 12,
      borderRadius: R.lg,
      borderWidth: 1,
      borderColor: colors.brand + "22",
      backgroundColor: colors.surface + "F2"
    },
    mapBlueprintCompassEyebrow: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.7,
      color: colors.brand
    },
    mapBlueprintCompassLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textPrimary
    },
    mapBlueprintCompassBody: {
      fontSize: 11,
      color: colors.textMuted,
      lineHeight: 16
    },
    mapBlueprintMarker: {
      position: "absolute" as const,
      gap: 4,
      padding: 10,
      borderRadius: R.lg,
      borderWidth: 1,
      justifyContent: "flex-end"
    },
    mapBlueprintMarkerPrimary: {
      borderColor: colors.brand + "3D",
      backgroundColor: colors.brand + "12"
    },
    mapBlueprintMarkerMuted: {
      borderColor: colors.border,
      backgroundColor: colors.surface + "CC"
    },
    mapBlueprintMarkerLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textPrimary
    },
    mapBlueprintMarkerHint: {
      fontSize: 10,
      color: colors.textMuted,
      lineHeight: 14
    },
    mapGridLine: {
      position: "absolute" as const,
      backgroundColor: colors.border,
      opacity: 0.45
    },
    mapZone: {
      position: "absolute" as const,
      padding: 6,
      borderWidth: 1,
      borderRadius: R.lg,
      zIndex: 2
    },
    mapZoneBackdrop: {
      ...StyleSheet.absoluteFill,
      borderRadius: R.lg,
      backgroundColor: colors.surfaceRaised,
      opacity: 0.5
    },
    mapEmptyState: {
      position: "absolute" as const,
      left: 22,
      right: 22,
      top: 124,
      borderRadius: R.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface + "F4",
      padding: 18,
      alignItems: "flex-start",
      gap: 10,
      zIndex: 2
    },
    mapEmptyStateTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary
    },
    mapEmptyStateBody: {
      fontSize: 13,
      lineHeight: 19,
      color: colors.textSecondary
    },
    mapEmptyStateAction: {
      marginTop: 4
    },
    mapZoneBadge: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      zIndex: 1
    },
    mapZoneLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textPrimary,
      textAlign: "center" as const
    },
    mapZoneMeta: {
      fontSize: 10,
      color: colors.textMuted,
      textAlign: "center" as const
    },
    legendCard: {
      backgroundColor: colors.surfaceRaised,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: R.xl,
      padding: 14,
      marginTop: -4
    },
    mapLegendInner: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 4 },
    mapLegendEmpty: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 19
    },
    mapLegendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6
    },
    mapLegendLabel: { fontSize: 13, color: colors.textPrimary, fontWeight: "600" },
    mapTip: { fontSize: 12, color: colors.textMuted, fontStyle: "italic", marginBottom: 16 }
  });
}

export function makeWorkoutStyles(colors: ThemeColors) {
  return StyleSheet.create({
    previewInner: {
      height: 450,
      minHeight: 360,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      borderRadius: 0
    },
    cameraView: { ...StyleSheet.absoluteFill, backgroundColor: "#000000" },
    gridOverlay: { ...StyleSheet.absoluteFill, pointerEvents: "none" as const },
    gridLine: { position: "absolute" as const, backgroundColor: colors.border },
    initButtonWrap: {
      position: "absolute" as const,
      top: "50%" as any,
      left: 0,
      right: 0,
      alignItems: "center",
      transform: [{ translateY: -24 }]
    },
    cameraSwitchOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.74)",
      paddingHorizontal: 24,
      zIndex: 8
    },
    cameraSwitchTitle: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "800",
      textAlign: "center"
    },
    cameraSwitchHint: {
      color: "rgba(255,255,255,0.72)",
      fontSize: 12,
      lineHeight: 17,
      marginTop: 6,
      textAlign: "center"
    },
    countdownOverlay: {
      position: "absolute" as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.45)",
      zIndex: 10
    },
    countdownText: { fontSize: 96, fontWeight: "700", color: "#FFFFFF" },
    previewOverlayTop: {
      position: "absolute" as const,
      left: 16,
      right: 16,
      top: 16,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center"
    },
    previewTopRightCluster: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8
    },
    cameraToggleButton: {
      minHeight: 0,
      borderRadius: R.lg,
      backgroundColor: "rgba(0,0,0,0.45)",
      paddingHorizontal: 10,
      paddingVertical: 5
    },
    cameraToggleText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },
    previewOverlayTopCenter: {
      position: "absolute" as const,
      left: 16,
      right: 16,
      top: 56,
      alignItems: "center"
    },
    timerPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(0,0,0,0.45)",
      borderRadius: R.lg,
      paddingHorizontal: 10,
      paddingVertical: 5
    },
    timerDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.brand },
    timerText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
    repsPill: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 6,
      backgroundColor: "rgba(0,0,0,0.45)",
      borderRadius: R.lg,
      paddingHorizontal: 16,
      paddingVertical: 7
    },
    repsText: { fontSize: 40, fontWeight: "700", color: "#FFFFFF" },
    repsPillLabel: { fontSize: 16, fontWeight: "600", color: "rgba(255,255,255,0.75)" },
    kcalPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: "rgba(0,0,0,0.45)",
      borderRadius: R.lg,
      paddingHorizontal: 10,
      paddingVertical: 5
    },
    kcalText: { fontSize: 13, fontWeight: "600", color: "#FFFFFF" },
    sectionLabel: { fontSize: 15, fontWeight: "600", color: colors.textPrimary, marginBottom: 10 },
    presetField: { marginBottom: 16 },
    presetHint: { fontSize: 12, color: colors.textMuted, marginTop: -8, marginBottom: 16 },
    statsRow: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: R.xl,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
      overflow: "hidden"
    },
    statBox: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 4 },
    statDivider: { width: 1, backgroundColor: colors.border },
    statValue: { fontSize: 22, fontWeight: "700", color: colors.textPrimary },
    statLabel: { fontSize: 11, color: colors.textMuted },
    tipsCard: {
      backgroundColor: colors.surfaceRaised,
      borderRadius: R.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 8
    },
    tipsHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
    tipsTitle: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
    tipRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    tipBullet: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.brand },
    tipText: { fontSize: 13, color: colors.textSecondary, flex: 1 },
    previewControls: {
      position: "absolute" as const,
      left: 0,
      right: 0,
      bottom: 16,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 12,
      paddingVertical: 4
    },
    previewControlButton: {
      width: 50,
      height: 50,
      borderRadius: 25,
      paddingHorizontal: 0,
      paddingVertical: 0
    },
    lowerContentWrap: { position: "relative" as const }
  });
}

export function makeNutritionStyles(colors: ThemeColors) {
  return StyleSheet.create({
    caloriesCard: {
      backgroundColor: colors.surface,
      borderRadius: R.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      marginBottom: 16,
      position: "relative" as const,
      overflow: "hidden"
    },
    caloriesCardActive: {
      backgroundColor: colors.brand,
      borderRadius: R.xl,
      borderWidth: 1,
      borderColor: colors.brand,
      padding: 20,
      marginBottom: 16,
      position: "relative" as const,
      overflow: "hidden"
    },
    caloriesGoalName: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.onBrand,
      letterSpacing: 1,
      marginBottom: 6
    },
    caloriesLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textMuted,
      letterSpacing: 0.5,
      marginBottom: 4
    },
    caloriesLabelActive: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.onBrand,
      opacity: 0.75,
      letterSpacing: 0.5,
      marginBottom: 4
    },
    caloriesValue: {
      fontSize: 48,
      fontWeight: "700",
      color: colors.textPrimary,
      lineHeight: 54
    },
    caloriesValueActive: {
      fontSize: 48,
      fontWeight: "700",
      color: colors.onBrand,
      lineHeight: 54
    },
    caloriesTarget: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: 2,
      marginBottom: 14
    },
    caloriesTargetActive: {
      fontSize: 14,
      color: colors.onBrand,
      opacity: 0.8,
      marginTop: 2,
      marginBottom: 14
    },
    caloriesFlameCircle: {
      position: "absolute" as const,
      top: 20,
      right: 20,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.brand + "18",
      alignItems: "center",
      justifyContent: "center"
    },
    caloriesFlameCircleActive: {
      position: "absolute" as const,
      top: 20,
      right: 20,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.2)",
      alignItems: "center",
      justifyContent: "center"
    },
    caloriesBar: {
      height: 6,
      backgroundColor: colors.border,
      borderRadius: 3,
      overflow: "hidden",
      marginBottom: 6
    },
    caloriesBarActive: {
      height: 6,
      backgroundColor: "rgba(255,255,255,0.25)",
      borderRadius: 3,
      overflow: "hidden",
      marginBottom: 6
    },
    caloriesBarFill: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.brand
    },
    caloriesBarFillActive: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.onBrand
    },
    caloriesRemaining: {
      fontSize: 12,
      color: colors.textMuted
    },
    caloriesRemainingActive: {
      fontSize: 12,
      color: colors.onBrand,
      opacity: 0.75
    },
    macroBlock: {
      padding: 16,
      gap: 4
    },
    macroRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 8,
      marginTop: 10,
      marginBottom: 4
    },
    macroDot: {
      width: 8,
      height: 8,
      borderRadius: 4
    },
    macroName: {
      fontSize: 14,
      color: colors.textSecondary,
      flex: 1
    },
    macroValue: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textPrimary
    },
    macroTrack: {
      height: 5,
      backgroundColor: colors.border,
      borderRadius: 3,
      overflow: "hidden"
    },
    macroFill: {
      height: 5,
      borderRadius: 3
    },
    macroRemaining: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
      marginBottom: 4
    },
    sectionBlock: {
      padding: 16,
      gap: 8
    },
    signalStack: {
      gap: 10
    },
    signalCard: {
      borderRadius: R.lg,
      borderWidth: 1,
      padding: 12,
      gap: 4
    },
    signalCardBrand: {
      borderColor: colors.brand + "2E",
      backgroundColor: colors.brand + "10"
    },
    signalCardWarning: {
      borderColor: colors.warning + "32",
      backgroundColor: colors.warning + "12"
    },
    signalCardSuccess: {
      borderColor: colors.success + "30",
      backgroundColor: colors.success + "12"
    },
    signalEyebrow: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 1
    },
    signalTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textPrimary
    },
    signalMessage: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textMuted
    },
    sectionNote: {
      fontSize: 11,
      color: colors.textMuted,
      lineHeight: 16
    },
    contentCard: {
      backgroundColor: colors.surfaceRaised,
      borderRadius: R.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 16,
      gap: 6
    },
    matchBadge: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.brand,
      letterSpacing: 1,
      marginBottom: 2
    },
    matchTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary
    },
    matchSubtitle: {
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: 8
    },
    cardList: {
      backgroundColor: colors.surface,
      borderRadius: R.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      marginBottom: 10
    },
    disclaimer: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: "center" as const,
      marginTop: 8,
      marginBottom: 20,
      paddingHorizontal: 16,
      lineHeight: 16
    }
  });
}

export function makeBrodigyStyles(colors: ThemeColors) {
  return StyleSheet.create({
    messagesArea: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12
    },
    aiBubbleRow: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      gap: 8
    },
    aiAvatar: {
      width: 30,
      height: 30,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      flexShrink: 0
    },
    aiAvatarText: {
      fontSize: 13,
      fontWeight: "700"
    },
    aiBubble: {
      backgroundColor: colors.surfaceRaised,
      borderRadius: 4,
      borderTopRightRadius: 12,
      borderBottomLeftRadius: 12,
      borderBottomRightRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 10,
      maxWidth: "84%" as any,
      flexShrink: 1
    },
    aiBubbleText: {
      fontSize: 14,
      color: colors.textPrimary,
      lineHeight: 20
    },
    userBubble: {
      backgroundColor: colors.brand,
      borderRadius: 12,
      borderTopRightRadius: 4,
      padding: 10,
      maxWidth: "84%" as any,
      alignSelf: "flex-end" as const
    },
    userBubbleText: {
      fontSize: 14,
      color: colors.onBrand ?? "#FFFFFF",
      lineHeight: 20
    },
    dotsWrap: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 2
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.textMuted
    },
    inputBar: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.base
    },
    inputWrap: {
      flex: 1,
      backgroundColor: colors.fieldBg,
      borderRadius: R.md,
      borderWidth: 1,
      borderColor: colors.fieldBorder,
      paddingHorizontal: 12,
      height: 44,
      justifyContent: "center" as const
    },
    sendBtn: {
      width: 46,
      height: 46,
      borderRadius: 12,
      backgroundColor: colors.brand,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      flexShrink: 0
    }
  });
}
