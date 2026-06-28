import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
export default defineConfig({
  plugins: [
    tanstackStart({
      server: { entry: "server" },
      spa: {
        enabled: process.env.GITHUB_PAGES === "true",
      },
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  base: process.env.GITHUB_PAGES === "true" ? "/Wakely/" : "/",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@supabase")) return "supabase-vendor";
          if (id.includes("framer-motion")) return "motion-vendor";
          if (id.includes("recharts") || id.includes("d3-")) return "charts-vendor";
          if (id.includes("xlsx")) return "xlsx";
        },
      },
    },
  },
});
