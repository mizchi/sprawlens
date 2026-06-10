import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [preact()],
  publicDir: "public-atlas",
  server: {
    proxy: {
      // atlas symbol-dependency server (pnpm dev:atlas-server)
      "/api": "http://127.0.0.1:4710",
    },
  },
  build: {
    outDir: "dist/atlas",
    emptyOutDir: false,
    rollupOptions: {
      input: "atlas.html",
    },
  },
});
