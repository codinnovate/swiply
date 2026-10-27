import type { Metadata, Viewport } from "next";
import { DM_Sans, Instrument_Serif } from "next/font/google";
import { AppProviders } from "@/providers/app-providers";
import "./globals.css";

const instrumentSerif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument-serif" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });

export const metadata: Metadata = { title: { default: "Swiply - Slideshows on autopilot", template: "%s · Swiply" }, description: "Swiply turns your product into scroll-stopping image slideshows and publishes them straight to TikTok and Instagram.", applicationName: "Swiply" };
export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f9fafc" }, { media: "(prefers-color-scheme: dark)", color: "#0e1320" }] };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning className={`${instrumentSerif.variable} ${dmSans.variable}`}><body className="min-h-dvh antialiased"><AppProviders>{children}</AppProviders></body></html>;
}
