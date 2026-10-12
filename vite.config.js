import { defineConfig } from "vite";
import { resolve } from "node:path";

// SPA prototype: only the brand pages participate. FLUED pages stay classic MPA.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        people: resolve(__dirname, "people.html"),
        insightsMemory: resolve(__dirname, "insights-memory-hierarchy.html"),
      },
    },
  },
});
