"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useFontClass } from "@/contexts/ThemeContext";

export default function RootLayoutClient() {
  const fontClass = useFontClass();
  const pathname = usePathname() ?? "/";
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/locked");

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    root.classList.remove("font-retro", "font-painter");
    if (fontClass) root.classList.add(fontClass);

    body.classList.remove("site-font-retro", "site-font-painter", "auth-route");
    if (isAuthRoute) {
      body.classList.add("auth-route");
      return;
    }

    if (fontClass === "font-retro") body.classList.add("site-font-retro");
    if (fontClass === "font-painter") body.classList.add("site-font-painter");
  }, [fontClass, isAuthRoute]);

  return null;
}