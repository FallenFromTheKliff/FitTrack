"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useFontClass } from "@/contexts/ThemeContext";
import { shouldUseDefaultPublicAppearance } from "@/utils/publicAppearance";

export default function RootLayoutClient() {
  const fontClass = useFontClass();
  const pathname = usePathname() ?? "/";
  const isPublicDefaultAppearanceRoute =
    shouldUseDefaultPublicAppearance(pathname);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    root.classList.remove("font-retro", "font-painter");
    if (fontClass) root.classList.add(fontClass);

    body.classList.remove("site-font-retro", "site-font-painter", "auth-route");
    if (isPublicDefaultAppearanceRoute) {
      body.classList.add("auth-route");
      return;
    }

    if (fontClass === "font-retro") body.classList.add("site-font-retro");
    if (fontClass === "font-painter") body.classList.add("site-font-painter");
  }, [fontClass, isPublicDefaultAppearanceRoute]);

  return null;
}
