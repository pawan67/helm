import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Provider } from "@/components/ui/provider";

// Industrial signage grotesk (body) + heavy condensed (display) + tabular mono
// (telemetry). Exposed as CSS vars that the Chakra font tokens reference.
const body = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});
const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HELM — self-hosted home & body console",
  description:
    "A self-hosted console for the systems you run: live pull-up and hang tracking, room climate, and device control.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#1a1c20", // steel canvas
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // suppressHydrationWarning: next-themes injects the color-mode class on <html>
  // before hydration, which would otherwise trip a mismatch warning.
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${body.variable} ${display.variable} ${mono.variable}`}
    >
      <body>
        <Provider defaultTheme="dark" enableSystem={false} forcedTheme="dark">
          {children}
        </Provider>
      </body>
    </html>
  );
}
