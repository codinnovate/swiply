import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://postlock.up.railway.app";
const description =
  "POSTLOCK is an iOS app that helps you keep a consistent posting habit on X. Set a posting goal and schedule, and POSTLOCK helps you stay focused on X when you miss a deadline.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "POSTLOCK — Post first. Scroll later.",
  description,
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    title: "POSTLOCK — Post first. Scroll later.",
    description,
    url: siteUrl,
    siteName: "POSTLOCK",
    images: ["/icon.png"],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "POSTLOCK — Post first. Scroll later.",
    description,
    images: ["/icon.png"],
  },
};

export const viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
