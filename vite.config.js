import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        people: resolve(__dirname, "people.html"),
        flued: resolve(__dirname, "flued.html"),
        fluedEvidence: resolve(__dirname, "flued-evidence.html"),
        fluedExperiments: resolve(__dirname, "flued-experiments.html"),
        fluedArchitecture: resolve(__dirname, "flued-architecture.html"),
        fluedDemo: resolve(__dirname, "flued-demo.html"),
        insightsMemory: resolve(__dirname, "insights-memory-hierarchy.html"),
      },
    },
  },
});
