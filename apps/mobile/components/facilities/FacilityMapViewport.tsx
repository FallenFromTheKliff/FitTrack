import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import type { FacilityFloorSnapshot, FacilityMapRegionSnapshot } from "@fittrack/types";
import { FitButton } from "@/components/fit";
import { FitText } from "@/components/fit/FitText";
import { useTheme } from "@/contexts/ThemeContext";
import { buildRenderableAssetUrl } from "@fittrack/utils";
import { MOBILE_API_BASE_URL } from "@/lib/api-client";
import {
  computeFacilityMapFit,
  computeFacilityMapFocalTranslation,
  constrainFacilityMapTranslation,
  clampFacilityMapScale,
} from "@/utils/facilityMapViewport";
import { buildFacilityMapRoute } from "./facilityMapRoute";

const CELL = 40;

export function FacilityMapViewport({
  floor,
  selectedRegionId,
  onSelectRegion,
  onGestureActiveChange,
}: {
  floor: FacilityFloorSnapshot;
  selectedRegionId: string | null;
  onSelectRegion: (region: FacilityMapRegionSnapshot) => void;
  onGestureActiveChange?: (active: boolean) => void;
}) {
  const { colors } = useTheme();
  const [viewport, setViewport] = useState({ width: 320, height: 480 });
  const scale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const activeGestures = useRef(0);
  const beginGesture = () => {
    activeGestures.current += 1;
    onGestureActiveChange?.(true);
  };
  const endGesture = () => {
    activeGestures.current = Math.max(0, activeGestures.current - 1);
    if (activeGestures.current === 0) onGestureActiveChange?.(false);
  };
  const selected = floor.regions.find((region) => region.id === selectedRegionId) ?? null;
  const route = useMemo(() => {
    return buildFacilityMapRoute(floor, selected);
  }, [floor, selected]);
  const routeKeys = useMemo(() => new Set(route.map((cell) => `${cell.column}:${cell.row}`)), [route]);
  const fit = useCallback(() => {
    const next = computeFacilityMapFit(floor.footprintCells, viewport, CELL);
    scale.value = withTiming(next.scale);
    x.value = withTiming(next.translateX);
    y.value = withTiming(next.translateY);
  }, [floor.footprintCells, scale, viewport, x, y]);
  useEffect(() => {
    fit();
    return () => onGestureActiveChange?.(false);
  }, [fit, floor.floorId, onGestureActiveChange]);
  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .runOnJS(true)
    .onBegin(() => {
      beginGesture();
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((event) => { x.value = startX.value + event.translationX; y.value = startY.value + event.translationY; })
    .onEnd(() => {
      const constrained = constrainFacilityMapTranslation(
        { x: x.value, y: y.value }, viewport, scale.value,
        floor.footprintCells, CELL,
      );
      x.value = withTiming(constrained.x); y.value = withTiming(constrained.y);
    })
    .onFinalize(endGesture);
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onBegin(() => {
      beginGesture();
      startScale.value = scale.value;
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((event) => {
      const nextScale = clampFacilityMapScale(startScale.value * event.scale);
      const next = computeFacilityMapFocalTranslation({
        focalX: event.focalX,
        focalY: event.focalY,
        nextScale,
        startScale: startScale.value,
        startX: startX.value,
        startY: startY.value,
      });
      scale.value = nextScale;
      x.value = next.x;
      y.value = next.y;
    })
    .onEnd(() => {
      const constrained = constrainFacilityMapTranslation(
        { x: x.value, y: y.value }, viewport, scale.value,
        floor.footprintCells, CELL,
      );
      x.value = withTiming(constrained.x);
      y.value = withTiming(constrained.y);
    })
    .onFinalize(endGesture);
  const mapStyle = useAnimatedStyle(() => ({
    transformOrigin: [0, 0, 0],
    transform: [
      { translateX: x.value }, { translateY: y.value }, { scale: scale.value },
    ],
  }));
  const imageUrl = buildRenderableAssetUrl({ apiBaseUrl: MOBILE_API_BASE_URL, assetUrl: floor.imageUrl });
  const cellStyle = (column: number, row: number) => ({
    left: (column - 1) * CELL, top: (row - 1) * CELL, width: CELL, height: CELL,
  });

  return (
    <View style={[styles.viewport, { borderColor: colors.border, backgroundColor: colors.base }]}
      onLayout={(event) => {
        const next = event.nativeEvent.layout;
        setViewport({ width: next.width, height: next.height });
        const fitted = computeFacilityMapFit(floor.footprintCells, next, CELL);
        scale.value = fitted.scale; x.value = fitted.translateX; y.value = fitted.translateY;
      }}>
      <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
        <Animated.View style={[styles.map, mapStyle]}>
          {floor.footprintCells.map((cell) => <View key={`f-${cell.column}-${cell.row}`}
            style={[styles.cell, cellStyle(cell.column, cell.row), { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]} />)}
          {imageUrl ? <Image source={{ uri: imageUrl }} resizeMode="contain" style={styles.image} /> : null}
          {floor.pathCells.map((cell) => <View key={`p-${cell.column}-${cell.row}`}
            style={[styles.cell, cellStyle(cell.column, cell.row), { backgroundColor: colors.brand + "35" }]} />)}
          {floor.entryCells.map((cell) => <View key={`en-${cell.column}-${cell.row}`}
            style={[styles.cell, cellStyle(cell.column, cell.row), { backgroundColor: colors.success + "88" }]}><FitText style={styles.cellLabel}>IN</FitText></View>)}
          {floor.exitCells.map((cell) => <View key={`ex-${cell.column}-${cell.row}`}
            style={[styles.cell, cellStyle(cell.column, cell.row), { backgroundColor: colors.warning + "88" }]}><FitText style={styles.cellLabel}>OUT</FitText></View>)}
          {floor.regions.map((region) => <Pressable key={region.id}
            accessibilityRole="button" accessibilityLabel={`Open ${region.name} details`}
            onPress={() => onSelectRegion(region)} style={[styles.region, {
              left: (region.gridColumn - 1) * CELL, top: (region.gridRow - 1) * CELL,
              width: region.gridWidth * CELL, height: region.gridHeight * CELL,
              borderColor: selectedRegionId === region.id ? colors.brand : region.status === "maintenance" ? colors.danger : colors.border,
              backgroundColor: colors.surface + "E8",
            }]}><FitText style={[styles.regionText, { color: colors.textPrimary }]}>{region.name}</FitText></Pressable>)}
          {floor.equipment.map((item) => <View key={item.id} style={[styles.equipment,
            cellStyle(item.gridColumn, item.gridRow), { borderColor: colors.brand, backgroundColor: colors.base + "E8" }]}>
            <FitText numberOfLines={1} style={[styles.equipmentText, { color: colors.textPrimary }]}>{item.name}</FitText>
          </View>)}
          {route.map((cell) => <View pointerEvents="none" key={`r-${cell.column}-${cell.row}`}
            style={[styles.route, cellStyle(cell.column, cell.row), { borderColor: colors.brand }]} />)}
        </Animated.View>
      </GestureDetector>
      <View style={styles.controls}><FitButton label="Fit / Reset" variant="ghost" onPress={fit} /></View>
      {selected && routeKeys.size === 0 ? <View style={[styles.status, { backgroundColor: colors.base + "EE" }]}>
        <FitText style={{ color: colors.textMuted }}>No published path reaches this zone.</FitText>
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { height: 480, borderWidth: 1, borderRadius: 18, overflow: "hidden" },
  map: { position: "absolute", width: 14 * CELL, height: 10 * CELL },
  image: { ...StyleSheet.absoluteFillObject, opacity: 0.22 },
  cell: { position: "absolute", borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  cellLabel: { fontSize: 8, fontWeight: "800" },
  route: { position: "absolute", borderWidth: 3 },
  region: { position: "absolute", borderWidth: 2, borderRadius: 8, padding: 5, alignItems: "center", justifyContent: "center" },
  regionText: { fontSize: 10, fontWeight: "700", textAlign: "center" },
  equipment: { position: "absolute", zIndex: 4, borderWidth: 1, padding: 2, alignItems: "center", justifyContent: "center" },
  equipmentText: { fontSize: 7, textAlign: "center" },
  controls: { position: "absolute", right: 8, top: 8 },
  status: { position: "absolute", left: 10, right: 10, bottom: 10, borderRadius: 10, padding: 10 },
});
