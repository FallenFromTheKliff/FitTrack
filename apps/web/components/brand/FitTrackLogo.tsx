import Image from "next/image";
import type { CSSProperties } from "react";

import logo from "../../public/brand/fittrack-logo.png";

type FitTrackLogoProps = {
  alt?: string;
  className?: string;
  priority?: boolean;
  size: number;
  style?: CSSProperties;
};

export default function FitTrackLogo({
  alt = "",
  className,
  priority = false,
  size,
  style,
}: FitTrackLogoProps) {
  return (
    <Image
      alt={alt}
      aria-hidden={alt ? undefined : true}
      className={className}
      data-testid="fittrack-logo"
      height={size}
      priority={priority}
      sizes={`${size}px`}
      src={logo}
      style={{
        borderRadius: "inherit",
        display: "block",
        height: "100%",
        objectFit: "contain",
        width: "100%",
        ...style,
      }}
      width={size}
    />
  );
}
