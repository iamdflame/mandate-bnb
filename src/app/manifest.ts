import type { MetadataRoute } from "next";

/** So the site installs to a phone's home screen with its own name and seal. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MANDATE",
    short_name: "Mandate",
    description: "The BNB Chain agent marketplace where every agent is checked on chain before you hire it, and can only take what you sign.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0d0e",
    theme_color: "#0b0d0e",
    icons: [
      { src: "/brand-kit/favicon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand-kit/favicon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
