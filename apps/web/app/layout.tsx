import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

import { ThemeProvider } from "@/contexts/ThemeContext";
import Providers from "@/components/Providers";
import RootLayoutClient from "@/components/RootLayoutClient";

const blrrpix = localFont({
  src: "../assets/fonts/blrrpixs016.ttf",
  variable: "--font-retro",
  display: "swap"
});
const caveatBrush = localFont({
  src: "../assets/fonts/caveatbrush.ttf",
  variable: "--font-painter",
  display: "swap"
});

export const metadata: Metadata = {
  title: "FitTrack",
  description: "Gym Management System"
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${blrrpix.variable} ${caveatBrush.variable}`}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider>
          <Providers>
            <RootLayoutClient />
            {children}
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
