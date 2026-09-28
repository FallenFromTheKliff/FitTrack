import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { LogIn, LogOut } from "lucide-react-native";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import type { FacilityFloorSnapshot, FacilityMapRegionSnapshot } from "@fittrack/types";
import { FitButton } from "@/components/fit";
import { FitText } from "@/components/fit/FitText";
import FacilityImageLightbox from "@/components/modals/shared/FacilityImageLightbox";
import { useTheme } from "@/contexts/ThemeContext";
import { buildRenderableAssetUrl } from "@fittrack/utils";
import { MOBILE_API_BASE_URL } from "@/lib/api-client";
import { getFacilityBookingBorderColor } from "@/utils/facilityStatus";
import {
  computeFacilityMapFit,
  computeFacilityMapFocalTranslation,
  computeFacilityPreviewOffset,
  constrainFacilityMapTranslation,
  clampFacilityMapScale,
  FACILITY_NODE_PREVIEW_HOLD_MS,
  resolveFacilityRegionPress,
} from "@/utils/facilityMapViewport";
import type { FacilityMapTranslation } from "@/utils/facilityMapViewport";
import { buildFacilityMapRoute } from "./facilityMapRoute";

const CELL = 40;
type FacilityNodePreview = {
  name: string;
  imageUrl: string;
  offset: FacilityMapTranslation;
};

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
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const pinchStartX = useSharedValue(0);
  const pinchStartY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const activeGestures = useRef(0);
  const previewOpenedByLongPress = useRef(false);
  const [previewNode, setPreviewNode] = useState<FacilityNodePreview | null>(null);
  const [regionImageIndexes, setRegionImageIndexes] = useState<Record<string, number>>({});
  const [failedRegionImages, setFailedRegionImages] = useState<Set<string>>(
    () => new Set(),
  );
  const bounds = useMemo(() => {
    if (floor.footprintCells.length === 0) {
      return { column: 1, row: 1, width: 14, height: 10 };
    }
    let minColumn = floor.footprintCells[0].column;
    let maxColumn = minColumn;
    let minRow = floor.footprintCells[0].row;
    let maxRow = minRow;
    for (const cell of floor.footprintCells) {
      minColumn = Math.min(minColumn, cell.column);
      maxColumn = Math.max(maxColumn, cell.column);
      minRow = Math.min(minRow, cell.row);
      maxRow = Math.max(maxRow, cell.row);
    }
    return {
      column: minColumn,
      row: minRow,
      width: maxColumn - minColumn + 1,
      height: maxRow - minRow + 1,
    };
  }, [floor.footprintCells]);
  const beginGesture = useCallback(() => {
    activeGestures.current += 1;
    onGestureActiveChange?.(true);
  }, [onGestureActiveChange]);
  const endGesture = useCallback(() => {
    activeGestures.current = Math.max(0, activeGestures.current - 1);
    if (activeGestures.current === 0) onGestureActiveChange?.(false);
  }, [onGestureActiveChange]);
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
  const pan = useMemo(() => Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .minDistance(8)
    .onBegin(() => {
      runOnJS(beginGesture)();
      panStartX.value = x.value;
      panStartY.value = y.value;
    })
    .onUpdate((event) => {
      x.value = panStartX.value + event.translationX;
      y.value = panStartY.value + event.translationY;
    })
    .onEnd(() => {
      const constrained = constrainFacilityMapTranslation(
        { x: x.value, y: y.value }, viewport, scale.value,
        floor.footprintCells, CELL,
      );
      x.value = withTiming(constrained.x);
      y.value = withTiming(constrained.y);
    })
    .onFinalize(() => runOnJS(endGesture)()),
  [beginGesture, endGesture, floor.footprintCells, panStartX, panStartY, scale, viewport, x, y]);
  const pinch = useMemo(() => Gesture.Pinch()
    .onBegin(() => {
      runOnJS(beginGesture)();
      startScale.value = scale.value;
      pinchStartX.value = x.value;
      pinchStartY.value = y.value;
    })
    .onUpdate((event) => {
      const nextScale = clampFacilityMapScale(startScale.value * event.scale);
      const next = computeFacilityMapFocalTranslation({
        focalX: event.focalX,
        focalY: event.focalY,
        nextScale,
        startScale: startScale.value,
        startX: pinchStartX.value,
        startY: pinchStartY.value,
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
    .onFinalize(() => runOnJS(endGesture)()),
  [beginGesture, endGesture, floor.footprintCells, pinchStartX, pinchStartY, scale, startScale, viewport, x, y]);
  const mapGesture = useMemo(() => Gesture.Simultaneous(pan, pinch), [pan, pinch]);
  const mapStyle = useAnimatedStyle(() => ({
    transformOrigin: [0, 0, 0],
    transform: [
      { translateX: x.value }, { translateY: y.value }, { scale: scale.value },
    ],
  }));
  const imageUrl = buildRenderableAssetUrl({ apiBaseUrl: MOBILE_API_BASE_URL, assetUrl: floor.imageUrl });
  const cellStyle = (column: number, row: number) => ({
    left: (column - bounds.column) * CELL,
    top: (row - bounds.row) * CELL,
    width: CELL,
    height: CELL,
  });
  const projectNodeCenter = (column: number, row: number, width: number, height: number) => ({
    x: x.value + ((column - bounds.column) + width / 2) * CELL * scale.value,
    y: y.value + ((row - bounds.row) + height / 2) * CELL * scale.value,
  });
  const openNodePreview = (
    name: string,
    assetUrl: string | null | undefined,
    projectedCenter: { x: number; y: number },
  ) => {
    const imageUrl = buildRenderableAssetUrl({ apiBaseUrl: MOBILE_API_BASE_URL, assetUrl: assetUrl ?? null });
    if (!imageUrl) return;
    previewOpenedByLongPress.current = true;
    setPreviewNode({
      name,
      imageUrl,
      offset: computeFacilityPreviewOffset(projectedCenter, viewport),
    });
  };

  return (
    <View style={[styles.viewport, { borderColor: colors.border, backgroundColor: colors.base }]}
      onLayout={(event) => {
        const next = event.nativeEvent.layout;
        setViewport({ width: next.width, height: next.height });
        const fitted = computeFacilityMapFit(floor.footprintCells, next, CELL);
        scale.value = fitted.scale; x.value = fitted.translateX; y.value = fitted.translateY;
      }}>
      <GestureDetector gesture={mapGesture}>
        <View style={styles.gestureSurface}>
          <Animated.View style={[styles.map, { width: bounds.width * CELL, height: bounds.height * CELL }, mapStyle]}>
          {floor.footprintCells.map((cell) => <View key={`f-${cell.column}-${cell.row}`}
            style={[styles.cell, cellStyle(cell.column, cell.row), { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]} />)}
          {imageUrl ? <Image source={{ uri: imageUrl }} resizeMode="contain" style={styles.image} /> : null}
          {floor.pathCells.map((cell) => <View key={`p-${cell.column}-${cell.row}`}
            style={[styles.cell, cellStyle(cell.column, cell.row), { backgroundColor: colors.brand + "35" }]} />)}
          {floor.entryCells.map((cell) => <View key={`en-${cell.column}-${cell.row}`}
            accessible accessibilityLabel="Entrance" accessibilityRole="image"
            style={[styles.cell, cellStyle(cell.column, cell.row), { backgroundColor: colors.success + "88" }]}>
            <LogIn size={15} color={colors.onBrand} strokeWidth={2} />
          </View>)}
          {floor.exitCells.map((cell) => <View key={`ex-${cell.column}-${cell.row}`}
            accessible accessibilityLabel="Exit" accessibilityRole="image"
            style={[styles.cell, cellStyle(cell.column, cell.row), { backgroundColor: colors.warning + "88" }]}>
            <LogOut size={15} color={colors.onBrand} strokeWidth={2} />
          </View>)}
          {floor.regions.map((region) => {
            const imageCandidates = Array.from(
              new Set(
                [
                  ...(region.imageUrls ?? []),
                  region.imageUrl,
                ]
                  .map((assetUrl) =>
                    buildRenderableAssetUrl({
                      apiBaseUrl: MOBILE_API_BASE_URL,
                      assetUrl: assetUrl ?? null,
                    }),
                  )
                  .filter((assetUrl): assetUrl is string => Boolean(assetUrl)),
              ),
            );
            const candidateIndex = regionImageIndexes[region.id] ?? 0;
            const regionImageUrl = imageCandidates[candidateIndex] ?? null;
            const hasRegionImage =
              Boolean(regionImageUrl) && !failedRegionImages.has(region.id);
            const regionBorderColor = region.isReservable
              ? getFacilityBookingBorderColor(
                  {
                    isBookable: region.isBookable,
                    todayBookingState: region.todayBookingState,
                  },
                  colors,
                )
              : selectedRegionId === region.id
                ? colors.brand
                : region.status === "maintenance"
                  ? colors.danger
                  : colors.border;
            return (
              <Pressable key={region.id}
                accessibilityRole="button" accessibilityLabel={`Open ${region.name} details`}
                onPress={() => {
                  const action = resolveFacilityRegionPress(
                    previewOpenedByLongPress.current,
                  );
                  previewOpenedByLongPress.current = false;
                  if (action === "select-region") onSelectRegion(region);
                }}
                onLongPress={() => {
                  openNodePreview(
                    region.name,
                    regionImageUrl,
                    projectNodeCenter(region.gridColumn, region.gridRow, region.gridWidth, region.gridHeight),
                  );
                }}
                delayLongPress={FACILITY_NODE_PREVIEW_HOLD_MS}
                style={[styles.region, {
                  left: (region.gridColumn - bounds.column) * CELL,
                  top: (region.gridRow - bounds.row) * CELL,
                  width: region.gridWidth * CELL, height: region.gridHeight * CELL,
                  borderColor: regionBorderColor,
                  backgroundColor: colors.surface + "E8",
                }]}
              >
                {hasRegionImage ? (
                  <>
                    <Image
                      source={{ uri: regionImageUrl }}
                      resizeMode="cover"
                      accessible={false}
                      onError={() => {
                        if (candidateIndex + 1 < imageCandidates.length) {
                          setRegionImageIndexes((current) => ({
                            ...current,
                            [region.id]: candidateIndex + 1,
                          }));
                        } else {
                          setFailedRegionImages((current) => {
                            if (current.has(region.id)) return current;
                            const next = new Set(current);
                            next.add(region.id);
                            return next;
                          });
                        }
                      }}
                      style={styles.regionImage}
                    />
                    <View
                      pointerEvents="none"
                      style={[styles.regionImageOverlay, { backgroundColor: colors.overlay + "AA" }]}
                    />
                  </>
                ) : null}
                <FitText
                  numberOfLines={2}
                  style={[styles.regionText, { color: hasRegionImage ? colors.onBrand : colors.textPrimary }]}
                >
                  {region.name}
                </FitText>
              </Pressable>
            );
          })}
          {floor.equipment.map((item) => {
            const equipmentWidth = item.gridWidth ?? 1;
            const equipmentHeight = item.gridHeight ?? 1;
            const equipmentStyle = [styles.equipment,
              cellStyle(item.gridColumn, item.gridRow), {
                borderColor: colors.brand,
                backgroundColor: colors.base + "E8",
              }];
            const equipmentContent = <FitText numberOfLines={1}
              style={[styles.equipmentText, { color: colors.textPrimary }]}>{item.name}</FitText>;
            const imageUrl = buildRenderableAssetUrl({
              apiBaseUrl: MOBILE_API_BASE_URL,
              assetUrl: item.imageUrl,
            });
            return imageUrl ? (
              <Pressable key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`Preview ${item.name} image`}
                onLongPress={() => openNodePreview(
                  item.name,
                  item.imageUrl,
                  projectNodeCenter(item.gridColumn, item.gridRow, equipmentWidth, equipmentHeight),
                )}
                delayLongPress={FACILITY_NODE_PREVIEW_HOLD_MS}
                style={equipmentStyle}
              >
                {equipmentContent}
              </Pressable>
            ) : (
              <View key={item.id} style={equipmentStyle}>{equipmentContent}</View>
            );
          })}
          {route.map((cell) => <View pointerEvents="none" key={`r-${cell.column}-${cell.row}`}
            style={[styles.route, cellStyle(cell.column, cell.row), { borderColor: colors.brand }]} />)}
          </Animated.View>
        </View>
      </GestureDetector>
      <View style={styles.controls}>
        <FitButton
          label="Fit"
          accessibilityLabel="Fit facility map"
          variant="ghost"
          onPress={fit}
          style={styles.fitButton}
          textStyle={styles.fitButtonText}
        />
      </View>
      {selected && routeKeys.size === 0 ? <View style={[styles.status, { backgroundColor: colors.base + "EE" }]}>
        <FitText style={{ color: colors.textMuted }}>No published path reaches this zone.</FitText>
      </View> : null}
      <FacilityImageLightbox
        imageUri={previewNode?.imageUrl ?? null}
        contentOffset={previewNode?.offset}
        isVisible={previewNode !== null}
        onClose={() => {
          previewOpenedByLongPress.current = false;
          setPreviewNode(null);
        }}
        title={previewNode?.name ?? "Facility"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { height: 480, borderWidth: 1, borderRadius: 18, overflow: "hidden" },
  gestureSurface: StyleSheet.absoluteFillObject,
  map: { position: "absolute" },
  image: { ...StyleSheet.absoluteFillObject, opacity: 0.22 },
  cell: { position: "absolute", borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  route: { position: "absolute", borderWidth: 3 },
  region: { position: "absolute", borderWidth: 2, borderRadius: 8, padding: 5, alignItems: "center", justifyContent: "center" },
  regionImage: { ...StyleSheet.absoluteFillObject },
  regionImageOverlay: { ...StyleSheet.absoluteFillObject },
  regionText: { fontSize: 10, fontWeight: "700", textAlign: "center" },
  equipment: { position: "absolute", zIndex: 4, borderWidth: 1, padding: 2, alignItems: "center", justifyContent: "center" },
  equipmentText: { fontSize: 7, textAlign: "center" },
  controls: { position: "absolute", right: 8, top: 8 },
  fitButton: { minWidth: 72, minHeight: 42, paddingHorizontal: 12 },
  fitButtonText: { flex: 1, textAlign: "center" },
  status: { position: "absolute", left: 10, right: 10, bottom: 10, borderRadius: 10, padding: 10 },
});
