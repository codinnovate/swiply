import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest { return { name: "Swiply", short_name: "Swiply", description: "AI social media studio", start_url: "/app", display: "standalone", background_color: "#fbf8f2", theme_color: "#ef6848", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }] }; }
