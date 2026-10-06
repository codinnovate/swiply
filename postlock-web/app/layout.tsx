import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";
import { APP_STORE_URL, OWNER_NAME, footerLinks, navLinks } from "./lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://postlock-app.up.railway.app";
const description =
  "POSTLOCK is an iOS app that helps you grow on X by posting consistently. Set daily posting goals, see scores and XP for every post, climb an opt-in creator leaderboard, and challenge other creators to posting duels.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "POSTLOCK — Post first. Scroll later.",
    template: "%s — POSTLOCK",
  },
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
  themeColor: "#0d0e14",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden bg-background text-foreground">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>

        <header className="sticky top-0 z-50 border-b border-surface-border bg-background/90 backdrop-blur">
          <nav
            aria-label="Primary"
            className="mx-auto flex w-full max-w-310 items-center justify-between px-4 py-4 sm:px-6"
          >
            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/icon.png"
                alt="POSTLOCK app icon"
                width={32}
                height={32}
                className="rounded-[9px]"
              />
              <span className="text-base font-semibold tracking-tight text-foreground">
                POSTLOCK
              </span>
            </Link>
            <div className="flex items-center gap-5 sm:gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="hidden text-sm text-muted transition-colors hover:text-foreground sm:inline-block"
                >
                  {link.label}
                </Link>
              ))}
              {APP_STORE_URL ? (
                <a
                  href={APP_STORE_URL}
                  className="hidden h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 sm:inline-flex"
                >
                  Download on the App Store
                </a>
              ) : (
                <span
                  aria-disabled="true"
                  className="hidden h-11 shrink-0 cursor-not-allowed items-center justify-center whitespace-nowrap rounded-full border border-surface-border px-5 text-sm font-semibold text-muted sm:inline-flex"
                >
                  Coming soon
                </span>
              )}
            </div>
          </nav>
        </header>

        <main id="main-content" className="flex-1">
          {children}
        </main>

        <footer className="border-t border-surface-border">
          <div className="mx-auto w-full max-w-310 px-4 py-12 sm:px-6">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-2.5">
                <Image
                  src="/icon.png"
                  alt="POSTLOCK app icon"
                  width={28}
                  height={28}
                  className="rounded-lg"
                />
                <span className="text-sm font-semibold text-foreground">
                  POSTLOCK
                </span>
              </div>
              <nav
                aria-label="Footer"
                className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted"
              >
                {footerLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                ))}
                <a
                  href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
                  className="hover:text-foreground"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Apple EULA
                </a>
              </nav>
            </div>
            <div className="mt-8 space-y-2 text-xs leading-5 text-muted">
              <p>
                &copy; {new Date().getFullYear()} {OWNER_NAME}. All rights
                reserved.
              </p>
              <p>
                POSTLOCK is not affiliated with, endorsed by, or sponsored by
                X Corp. or Apple Inc.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
