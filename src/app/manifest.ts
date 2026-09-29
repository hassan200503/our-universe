import type { MetadataRoute } from "next";

/** Installable on phones (Add to Home Screen), which is also what lets iPhones receive call alerts. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Our Universe",
    short_name: "Our Universe",
    description: "Hassan's world, Whitney's world, and the journey we're walking together.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0a0e",
    theme_color: "#0b0a0e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
