"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, Image as KonvaImage, Layer, Rect, Stage, Text } from "react-konva";

type ImageFit = "cover" | "contain";

type Props = {
  fit: ImageFit;
  focalX: number;
  focalY: number;
  imageUrl: string;
  zoom: number;
  backgroundColor: string;
  onFocalChange: (focalX: number, focalY: number) => void;
};

type ImageStatus = "idle" | "loading" | "loaded" | "failed";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function useImage(
  src: string,
  crossOrigin: "anonymous",
): [HTMLImageElement | null, ImageStatus] {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<ImageStatus>(src ? "loading" : "idle");

  useEffect(() => {
    if (!src) {
      setImage(null);
      setStatus("idle");
      return;
    }

    let active = true;
    const nextImage = new window.Image();
    nextImage.crossOrigin = crossOrigin;
    nextImage.onload = () => {
      if (!active) return;
      setImage(nextImage);
      setStatus("loaded");
    };
    nextImage.onerror = () => {
      if (!active) return;
      setImage(null);
      setStatus("failed");
    };
    setImage(null);
    setStatus("loading");
    nextImage.src = src;

    return () => {
      active = false;
      nextImage.onload = null;
      nextImage.onerror = null;
    };
  }, [crossOrigin, src]);

  return [image, status];
}

export default function VenueImageCropCanvas({
  fit,
  focalX,
  focalY,
  imageUrl,
  zoom,
  backgroundColor,
  onFocalChange,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [frameWidth, setFrameWidth] = useState(640);
  const [image, imageStatus] = useImage(imageUrl, "anonymous");
  const frameHeight = frameWidth / 2;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const updateWidth = (width: number) => {
      const nextWidth = Math.max(240, Math.round(width));
      setFrameWidth((current) => (current === nextWidth ? current : nextWidth));
    };
    updateWidth(host.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) updateWidth(width);
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const geometry = useMemo(() => {
    if (!image) return null;

    const imageWidth = image.naturalWidth || image.width;
    const imageHeight = image.naturalHeight || image.height;
    const fitScale =
      fit === "cover"
        ? Math.max(frameWidth / imageWidth, frameHeight / imageHeight)
        : Math.min(frameWidth / imageWidth, frameHeight / imageHeight);
    const scale = fitScale * clamp(zoom, 1, 3);
    const width = imageWidth * scale;
    const height = imageHeight * scale;
    const overflowX = Math.max(0, width - frameWidth);
    const overflowY = Math.max(0, height - frameHeight);
    const x = overflowX > 0 ? -clamp(focalX, 0, 1) * overflowX : (frameWidth - width) / 2;
    const y = overflowY > 0 ? -clamp(focalY, 0, 1) * overflowY : (frameHeight - height) / 2;

    return { height, overflowX, overflowY, width, x, y };
  }, [fit, focalX, focalY, frameHeight, frameWidth, image, zoom]);

  return (
    <div
      ref={hostRef}
      role="application"
      aria-label="Drag the venue image to adjust its crop"
      style={{ minHeight: 120, position: "relative", width: "100%" }}
    >
      <Stage width={frameWidth} height={frameHeight}>
        <Layer listening={imageStatus === "loaded"}>
          <Rect width={frameWidth} height={frameHeight} fill={backgroundColor} />
          <Group clipX={0} clipY={0} clipWidth={frameWidth} clipHeight={frameHeight}>
            {image && geometry ? (
              <KonvaImage
                image={image}
                x={geometry.x}
                y={geometry.y}
                width={geometry.width}
                height={geometry.height}
                draggable={geometry.overflowX > 0 || geometry.overflowY > 0}
                dragBoundFunc={(position) => ({
                  x:
                    geometry.overflowX > 0
                      ? clamp(position.x, frameWidth - geometry.width, 0)
                      : geometry.x,
                  y:
                    geometry.overflowY > 0
                      ? clamp(position.y, frameHeight - geometry.height, 0)
                      : geometry.y,
                })}
                onDragEnd={(event) => {
                  const position = event.target.position();
                  onFocalChange(
                    geometry.overflowX > 0
                      ? clamp(-position.x / geometry.overflowX, 0, 1)
                      : 0.5,
                    geometry.overflowY > 0
                      ? clamp(-position.y / geometry.overflowY, 0, 1)
                      : 0.5,
                  );
                }}
              />
            ) : null}
          </Group>
          {imageStatus !== "loaded" ? (
            <Text
              text={imageStatus === "failed" ? "Image preview unavailable" : "Loading image..."}
              width={frameWidth}
              y={frameHeight / 2 - 8}
              align="center"
              fill="rgba(255,255,255,0.78)"
              fontSize={13}
              listening={false}
            />
          ) : null}
          <Circle
            x={frameWidth / 2}
            y={frameHeight / 2}
            radius={8}
            stroke="rgba(255,255,255,0.9)"
            strokeWidth={1}
            listening={false}
          />
        </Layer>
      </Stage>
      {imageStatus === "failed" ? (
        <img
          alt="Venue crop fallback preview"
          src={imageUrl}
          draggable={false}
          style={{
            height: "100%",
            inset: 0,
            objectFit: fit,
            objectPosition: `${clamp(focalX, 0, 1) * 100}% ${clamp(focalY, 0, 1) * 100}%`,
            position: "absolute",
            transform: `scale(${clamp(zoom, 1, 3)})`,
            width: "100%",
          }}
        />
      ) : null}
    </div>
  );
}
