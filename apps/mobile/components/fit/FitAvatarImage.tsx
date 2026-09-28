import { type ReactNode, useEffect, useState } from "react";
import { Image, Platform } from "react-native";

type Props = {
  alt: string;
  borderRadius?: number;
  fallback: ReactNode;
  uri?: string | null;
};

export default function FitAvatarImage({
  alt,
  borderRadius = 0,
  fallback,
  uri
}: Props) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const resolvedUri = uri?.trim() ? uri.trim() : null;

  useEffect(() => {
    setFailedUri(null);
  }, [resolvedUri]);

  if (!resolvedUri || failedUri === resolvedUri) {
    return <>{fallback}</>;
  }

  if (Platform.OS === "web") {
    return (
      <img
        src={resolvedUri}
        alt={alt}
        onError={() => setFailedUri(resolvedUri)}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          objectFit: "cover",
          borderRadius
        }}
      />
    );
  }

  return (
    <Image
      source={{ uri: resolvedUri }}
      onError={() => setFailedUri(resolvedUri)}
      resizeMode="cover"
      style={{ width: "100%", height: "100%", borderRadius }}
    />
  );
}
