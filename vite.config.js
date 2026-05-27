import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  esbuild: {
    jsx: "automatic",
  },
  optimizeDeps: {
    esbuildOptions: {
      jsx: "automatic",
    },
  },
});
