import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react-native";

import type { ThemeColors } from "@fittrack/types";
import { buildRenderableAssetUrl } from "@fittrack/utils";
import { MOBILE_API_BASE_URL } from "@/lib/api-client";
import { useTheme } from "@/contexts/ThemeContext";
import { FitText } from "@/components/fit/FitText";

type Props = {
  images?: Array<string | null | undefined>;
  venueName: string;
  onOpenImage: (imageUri: string) => void;
};

function normalizeImages(images: Props["images"]) {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const image of images ?? []) {
    const uri = buildRenderableAssetUrl({
      apiBaseUrl: MOBILE_API_BASE_URL,
      assetUrl: image ?? null,
    });
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    result.push(uri);
    if (result.length === 8) break;
  }
  return result;
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    viewport: {
      width: "100%",
      aspectRatio: 16 / 9,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
      overflow: "hidden",
    },
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      paddingHorizontal: 20,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 11,
      textAlign: "center",
    },
    slide: {
      height: "100%",
      justifyContent: "center",
      position: "relative",
    },
    slideButton: {
      flex: 1,
      minWidth: 0,
    },
    image: {
      width: "100%",
      height: "100%",
      backgroundColor: colors.surfaceRaised,
    },
    failed: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingHorizontal: 16,
    },
    failedText: {
      color: colors.textMuted,
      fontSize: 11,
      textAlign: "center",
    },
    arrows: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 8,
      right: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      pointerEvents: "box-none",
    },
    arrow: {
      alignItems: "center",
      justifyContent: "center",
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.overlay,
      borderWidth: 1,
      borderColor: colors.onBrand + "66",
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 8,
      minHeight: 22,
    },
    position: {
      color: colors.textMuted,
      fontSize: 11,
    },
    dots: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    activeDot: {
      width: 18,
      backgroundColor: colors.brand,
    },
  });
}

export default function VenueImageCarousel({
  images,
  venueName,
  onOpenImage,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView | null>(null);
  const renderableImages = useMemo(() => normalizeImages(images), [images]);
  const imageCount = renderableImages.length;
  const [viewportWidth, setViewportWidth] = useState(0);
  const [pageIndex, setPageIndex] = useState(imageCount > 1 ? 1 : 0);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());

  const pages = useMemo(() => {
    if (imageCount < 2) return renderableImages;
    return [
      renderableImages[imageCount - 1],
      ...renderableImages,
      renderableImages[0],
    ];
  }, [imageCount, renderableImages]);

  useEffect(() => {
    setFailedImages(new Set());
    setPageIndex(imageCount > 1 ? 1 : 0);
  }, [imageCount, renderableImages]);

  const scrollToPage = useCallback(
    (nextPage: number, animated: boolean) => {
      if (!viewportWidth) return;
      scrollRef.current?.scrollTo({
        x: nextPage * viewportWidth,
        y: 0,
        animated,
      });
    },
    [viewportWidth],
  );

  useEffect(() => {
    if (imageCount > 1 && viewportWidth) {
      scrollToPage(1, false);
    }
  }, [imageCount, scrollToPage, viewportWidth]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width > 0 && width !== viewportWidth) setViewportWidth(width);
  }, [viewportWidth]);

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (imageCount < 2 || !viewportWidth) return;
      const rawPage = Math.round(
        event.nativeEvent.contentOffset.x / viewportWidth,
      );
      if (rawPage === 0) {
        setPageIndex(imageCount);
        scrollToPage(imageCount, false);
      } else if (rawPage === imageCount + 1) {
        setPageIndex(1);
        scrollToPage(1, false);
      } else {
        setPageIndex(Math.min(imageCount, Math.max(1, rawPage)));
      }
    },
    [imageCount, scrollToPage, viewportWidth],
  );

  const move = useCallback(
    (delta: -1 | 1) => {
      if (imageCount < 2) return;
      const nextPage = pageIndex + delta;
      if (nextPage <= 0) {
        setPageIndex(imageCount);
        scrollToPage(imageCount, false);
        return;
      }
      if (nextPage >= imageCount + 1) {
        setPageIndex(1);
        scrollToPage(1, false);
        return;
      }
      setPageIndex(nextPage);
      scrollToPage(nextPage, true);
    },
    [imageCount, pageIndex, scrollToPage],
  );

  const markImageFailed = useCallback((uri: string) => {
    setFailedImages((current) => {
      if (current.has(uri)) return current;
      const next = new Set(current);
      next.add(uri);
      return next;
    });
  }, []);

  if (imageCount === 0) {
    return (
      <View style={styles.viewport} accessibilityLabel={`${venueName} venue images`}>
        <View style={styles.empty}>
          <ImageIcon size={28} color={colors.textDisabled} strokeWidth={1.5} />
          <FitText style={styles.emptyText}>
            No venue images have been published yet.
          </FitText>
        </View>
      </View>
    );
  }

  const currentIndex = imageCount === 1
    ? 0
    : Math.min(imageCount - 1, Math.max(0, pageIndex - 1));

  return (
    <View>
      <View
        style={styles.viewport}
        onLayout={handleLayout}
        accessibilityLabel={`${venueName} venue image gallery`}
      >
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          directionalLockEnabled
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          nestedScrollEnabled
          onMomentumScrollEnd={handleMomentumEnd}
          contentContainerStyle={{ minWidth: viewportWidth * pages.length }}
        >
          {pages.map((uri, index) => {
            const failed = failedImages.has(uri);
            const pageImageIndex = imageCount === 1
              ? 0
              : index === 0
                ? imageCount - 1
                : index === imageCount + 1
                  ? 0
                  : index - 1;
            return (
              <View
                key={`${uri}-${index}`}
                style={[styles.slide, { width: Math.max(1, viewportWidth) }]}
              >
                {failed ? (
                  <View style={styles.failed} accessibilityLabel={`Image ${index + 1} unavailable`}>
                    <ImageIcon size={24} color={colors.textDisabled} strokeWidth={1.5} />
                    <FitText style={styles.failedText}>Image unavailable</FitText>
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open image ${pageImageIndex + 1} of ${imageCount} for ${venueName}`}
                    onPress={() => onOpenImage(uri)}
                    style={styles.slideButton}
                  >
                    <Image
                      source={{ uri }}
                      resizeMode="cover"
                      accessibilityLabel={`${venueName} image ${pageImageIndex + 1} of ${imageCount}`}
                      onError={() => markImageFailed(uri)}
                      style={styles.image}
                    />
                  </Pressable>
                )}
              </View>
            );
          })}
        </ScrollView>
        {imageCount > 1 ? (
          <View style={styles.arrows} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Previous image for ${venueName}`}
              onPress={() => move(-1)}
              style={styles.arrow}
            >
              <ChevronLeft size={18} color={colors.onBrand} strokeWidth={2.5} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Next image for ${venueName}`}
              onPress={() => move(1)}
              style={styles.arrow}
            >
              <ChevronRight size={18} color={colors.onBrand} strokeWidth={2.5} />
            </Pressable>
          </View>
        ) : null}
      </View>
      <View style={styles.footer}>
        <FitText style={styles.position}>{`Photo ${currentIndex + 1} of ${imageCount}`}</FitText>
        {imageCount > 1 ? (
          <View style={styles.dots} accessibilityLabel={`${venueName} image position`}>
            {renderableImages.map((uri, index) => (
              <Pressable
                key={uri}
                accessibilityRole="button"
                accessibilityLabel={`Show image ${index + 1} of ${imageCount} for ${venueName}`}
                accessibilityState={{ selected: currentIndex === index }}
                onPress={() => {
                  setPageIndex(index + 1);
                  scrollToPage(index + 1, true);
                }}
                style={[styles.dot, currentIndex === index ? styles.activeDot : undefined]}
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}
