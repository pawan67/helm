import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HELM — self-hosted home & body console",
    short_name: "HELM",
    description:
      "A self-hosted console for your training, room climate, and device control.",
    start_url: "/",
    display: "standalone",
    background_color: "#1c1e24", // slate canvas — matches the app + viewport
    theme_color: "#1c1e24",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
