"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { buildRenderableAssetUrl } from "@fittrack/utils";
import type { ThemeColors } from "@fittrack/types";

import { useTheme } from "@/contexts/ThemeContext";
import { WEB_API_BASE_URL } from "@/lib/api-client";
import FitButton from "@/components/fit/FitButton";
import { FitText } from "@/components/fit/FitText";
import {
  FacilityPointerSensor,
  useFacilityPointerDragCancellation,
} from "./facilityPointerDrag";
import { MAX_VENUE_IMAGES, normalizeVenueImageUrls } from "./venueImageGallery";

const VENUE_IMAGE_DRAG_PREFIX = "facility-venue-image:";

function buildVenueImageDragId(url: string) {
  return `${VENUE_IMAGE_DRAG_PREFIX}${url}`;
}

function getVenueImageFromDragId(id: UniqueIdentifier | null | undefined) {
  if (id === null || id === undefined) return null;
  const value = String(id);
  return value.startsWith(VENUE_IMAGE_DRAG_PREFIX)
    ? value.slice(VENUE_IMAGE_DRAG_PREFIX.length)
    : null;
}

type Props = {
  buttonLabel: string;
  disabled?: boolean;
  helperText: string;
  imageUrl?: string | null;
  imageUrls?: readonly string[] | null;
  maxImages?: number;
  onMoveImage?: (fromIndex: number, toIndex: number) => void;
  onRemoveImage?: (index: number) => void;
  onUpload: (file: File) => void;
  title: string;
};

type VenueImageTileProps = {
  canReorder: boolean;
  colors: ThemeColors;
  disabled: boolean;
  isDropTarget: boolean;
  onMoveImage?: (fromIndex: number, toIndex: number) => void;
  onRemoveImage?: (index: number) => void;
  galleryLength: number;
  index: number;
  title: string;
  url: string;
};

function VenueImageTile({
  canReorder,
  colors,
  disabled,
  isDropTarget,
  onMoveImage,
  onRemoveImage,
  galleryLength,
  index,
  title,
  url,
}: VenueImageTileProps) {
  const imageId = buildVenueImageDragId(url);
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
  } = useDraggable({
    id: imageId,
    data: { kind: "venue-image", url },
    disabled: !canReorder,
  });
  const { setNodeRef: setDropNodeRef } = useDroppable({
    id: imageId,
    data: { kind: "venue-image", url },
    disabled: !canReorder,
  });
  const setTileRef = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node);
      setDropNodeRef(node);
    },
    [setDropNodeRef, setNodeRef],
  );
  const renderableImageUrl = buildRenderableAssetUrl({
    apiBaseUrl: WEB_API_BASE_URL,
    assetUrl: url,
  });

  return (
    <div
      ref={setTileRef}
      draggable={false}
      onDragStart={(event) => event.preventDefault()}
      style={{
        aspectRatio: "4 / 3",
        backgroundColor: colors.surface,
        border: `1px ${isDropTarget && !isDragging ? "dashed" : "solid"} ${
          isDropTarget && !isDragging ? colors.brand : colors.border
        }`,
        borderRadius: 8,
        cursor: isDragging ? "grabbing" : canReorder ? "grab" : undefined,
        opacity: isDragging ? 0.55 : 1,
        minWidth: 0,
        overflow: "hidden",
        position: "relative",
        userSelect: "none",
      }}
    >
      {renderableImageUrl ? (
        <img
          ref={setActivatorNodeRef}
          {...(listeners ?? {})}
          {...attributes}
          src={renderableImageUrl}
          alt={`${title} ${index + 1}`}
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
          style={{
            height: "100%",
            objectFit: "cover",
            touchAction: canReorder ? "none" : "auto",
            userSelect: "none",
            width: "100%",
          }}
        />
      ) : (
        <ImagePlus size={22} color={colors.textMuted} />
      )}
      <FitText
        style={{
          backgroundColor: `${colors.base}D9`,
          bottom: 0,
          color: colors.textPrimary,
          fontSize: 10,
          fontWeight: 750,
          left: 0,
          padding: "4px 6px",
          pointerEvents: "none",
          position: "absolute",
          right: 0,
        }}
      >
        {index === 0 ? "COVER" : `IMAGE ${index + 1}`}
      </FitText>
      {onRemoveImage ? (
        <button
          type="button"
          aria-label={`Remove ${title} image ${index + 1}`}
          disabled={disabled}
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onRemoveImage(index)}
          style={{
            alignItems: "center",
            backgroundColor: `${colors.base}E6`,
            border: `1px solid ${colors.border}`,
            borderRadius: "50%",
            color: colors.textPrimary,
            cursor: disabled ? "not-allowed" : "pointer",
            display: "flex",
            fontSize: 16,
            height: 26,
            justifyContent: "center",
            lineHeight: 1,
            position: "absolute",
            right: 6,
            top: 6,
            width: 26,
          }}
        >
          ×
        </button>
      ) : null}
      {onMoveImage ? (
        <div
          aria-label={`Reorder ${title} image ${index + 1}`}
          onPointerDown={(event) => event.stopPropagation()}
          style={{
            alignItems: "center",
            backgroundColor: `${colors.base}D9`,
            bottom: 4,
            display: "flex",
            gap: 3,
            left: 4,
            padding: 2,
            position: "absolute",
          }}
        >
          <button
            type="button"
            aria-label={`Move ${title} image ${index + 1} earlier`}
            disabled={disabled || index === 0}
            draggable={false}
            onPointerDown={(event) => event.stopPropagation()}
            onDragStart={(event) => event.preventDefault()}
            onClick={() => onMoveImage(index, index - 1)}
            style={{
              background: "transparent",
              border: 0,
              color: colors.textPrimary,
              cursor: disabled || index === 0 ? "not-allowed" : "pointer",
              fontSize: 14,
              minHeight: 24,
              minWidth: 24,
            }}
          >
            ←
          </button>
          <button
            type="button"
            aria-label={`Move ${title} image ${index + 1} later`}
            disabled={disabled || index === galleryLength - 1}
            draggable={false}
            onPointerDown={(event) => event.stopPropagation()}
            onDragStart={(event) => event.preventDefault()}
            onClick={() => onMoveImage(index, index + 1)}
            style={{
              background: "transparent",
              border: 0,
              color: colors.textPrimary,
              cursor:
                disabled || index === galleryLength - 1
                  ? "not-allowed"
                  : "pointer",
              fontSize: 14,
              minHeight: 24,
              minWidth: 24,
            }}
          >
            →
          </button>
        </div>
      ) : null}
    </div>
  );
}

function VenueImageDragPreview({
  colors,
  index,
  url,
}: Pick<VenueImageTileProps, "colors" | "index" | "url">) {
  const renderableImageUrl = buildRenderableAssetUrl({
    apiBaseUrl: WEB_API_BASE_URL,
    assetUrl: url,
  });

  return (
    <div
      aria-hidden="true"
      style={{
        aspectRatio: "4 / 3",
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        overflow: "hidden",
        pointerEvents: "none",
        position: "relative",
        userSelect: "none",
        width: 104,
      }}
    >
      {renderableImageUrl ? (
        <img
          src={renderableImageUrl}
          alt=""
          draggable={false}
          style={{
            height: "100%",
            objectFit: "cover",
            userSelect: "none",
            width: "100%",
          }}
        />
      ) : (
        <ImagePlus size={22} color={colors.textMuted} />
      )}
      <FitText
        style={{
          backgroundColor: `${colors.base}D9`,
          bottom: 0,
          color: colors.textPrimary,
          fontSize: 10,
          fontWeight: 750,
          left: 0,
          padding: "4px 6px",
          pointerEvents: "none",
          position: "absolute",
          right: 0,
        }}
      >
        {index === 0 ? "COVER" : `IMAGE ${index + 1}`}
      </FitText>
    </div>
  );
}

export function FacilityImageUploadCard({
  buttonLabel,
  disabled = false,
  helperText,
  imageUrl,
  imageUrls,
  maxImages = MAX_VENUE_IMAGES,
  onMoveImage,
  onRemoveImage,
  onUpload,
  title,
}: Props) {
  const { colors } = useTheme();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const activeDragIdRef = useRef<string | null>(null);
  const [overDragId, setOverDragId] = useState<string | null>(null);
  const galleryUrls = normalizeVenueImageUrls({ imageUrl, imageUrls }).slice(
    0,
    maxImages,
  );
  const canReorder = Boolean(onMoveImage) && !disabled;
  const sensors = useSensors(
    useSensor(FacilityPointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );
  const dragContextKey = JSON.stringify({
    canReorder,
    disabled,
    galleryUrls,
    hasMoveCallback: Boolean(onMoveImage),
    maxImages,
    title,
  });
  useFacilityPointerDragCancellation(dragContextKey);

  const clearDragState = () => {
    activeDragIdRef.current = null;
    setActiveDragId(null);
    setOverDragId(null);
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    const nextActiveDragId = String(active.id);
    const activeUrl = getVenueImageFromDragId(active.id);
    if (
      !canReorder ||
      !activeUrl ||
      !galleryUrls.includes(activeUrl)
    ) {
      clearDragState();
      return;
    }
    activeDragIdRef.current = nextActiveDragId;
    setActiveDragId(nextActiveDragId);
    setOverDragId(null);
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    const currentActiveDragId = activeDragIdRef.current;
    const activeUrl = getVenueImageFromDragId(active.id);
    const overId = over ? String(over.id) : null;
    const overUrl = getVenueImageFromDragId(over?.id);
    if (
      !currentActiveDragId ||
      currentActiveDragId !== String(active.id) ||
      !activeUrl ||
      !overId ||
      !overUrl ||
      !galleryUrls.includes(activeUrl) ||
      !galleryUrls.includes(overUrl)
    ) {
      setOverDragId(null);
      return;
    }
    setOverDragId(overId);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const currentActiveDragId = activeDragIdRef.current;
    const overId = over ? String(over.id) : null;
    clearDragState();

    if (
      !canReorder ||
      !currentActiveDragId ||
      currentActiveDragId !== String(active.id) ||
      !overId
    ) {
      return;
    }

    const sourceUrl = getVenueImageFromDragId(currentActiveDragId);
    const targetUrl = getVenueImageFromDragId(overId);
    const sourceIndex = sourceUrl ? galleryUrls.indexOf(sourceUrl) : -1;
    const targetIndex = targetUrl ? galleryUrls.indexOf(targetUrl) : -1;
    if (
      sourceIndex < 0 ||
      targetIndex < 0 ||
      sourceIndex === targetIndex
    ) {
      return;
    }
    onMoveImage?.(sourceIndex, targetIndex);
  };
  const activeDragUrl = getVenueImageFromDragId(activeDragId);
  const activeDragIndex = activeDragUrl
    ? galleryUrls.indexOf(activeDragUrl)
    : -1;

  return (
    <DndContext
      collisionDetection={pointerWithin}
      onDragCancel={clearDragState}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      <div
        style={{
          padding: 12,
          borderRadius: 8,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.surfaceRaised,
        }}
      >
      <FitText style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}>
        {title.toUpperCase()}
      </FitText>
      <FitText style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>
        {helperText} The first image is the cover shown to members. {galleryUrls.length}/{maxImages} images.
      </FitText>
      <div
        style={{
          display: "grid",
          gap: 12,
          marginTop: 12,
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 8,
            gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))",
          }}
        >
          {galleryUrls.length > 0 ? (
            galleryUrls.map((url, index) => {
              const imageId = buildVenueImageDragId(url);
              return (
                <VenueImageTile
                  key={url}
                  canReorder={canReorder}
                  colors={colors}
                  disabled={disabled}
                  galleryLength={galleryUrls.length}
                  index={index}
                  isDropTarget={
                    overDragId === imageId && activeDragId !== imageId
                  }
                  onMoveImage={onMoveImage}
                  onRemoveImage={onRemoveImage}
                  title={title}
                  url={url}
                />
              );
            })
          ) : (
            <div
              style={{
                alignItems: "center",
                aspectRatio: "4 / 3",
                backgroundColor: colors.surface,
                border: `1px dashed ${colors.border}`,
                borderRadius: 8,
                display: "flex",
                justifyContent: "center",
                maxWidth: 160,
              }}
            >
              <ImagePlus size={22} color={colors.textMuted} />
            </div>
          )}
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              onUpload(file);
              event.currentTarget.value = "";
            }}
          />
          <FitButton
            variant="ghost"
            label={buttonLabel}
            onClick={() => inputRef.current?.click()}
            disabled={disabled || galleryUrls.length >= maxImages}
            style={{ width: "fit-content" }}
          />
        </div>
        </div>
      </div>
      <DragOverlay dropAnimation={null} style={{ pointerEvents: "none" }}>
        {activeDragUrl && activeDragIndex >= 0 ? (
          <VenueImageDragPreview
            colors={colors}
            index={activeDragIndex}
            url={activeDragUrl}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
