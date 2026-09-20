import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import { AppProviders } from "@/providers/app-providers";
import "./globals.css";

const instrumentSerif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-landing-serif" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-landing-inter" });

export const metadata: Metadata = { title: { default: "Swiply — Slideshows on autopilot", template: "%s · Swiply" }, description: "Swiply turns your product into scroll-stopping image slideshows and publishes them straight to TikTok and Instagram.", applicationName: "Swiply" };
export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#fbf8f2" }, { media: "(prefers-color-scheme: dark)", color: "#211c26" }] };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning className={`${instrumentSerif.variable} ${inter.variable}`}><body className="min-h-dvh antialiased"><AppProviders>{children}</AppProviders></body></html>;
}
