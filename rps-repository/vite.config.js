import { defineConfig } from "vite";
import offlinePlugin from "./scripts/offline-plugin.mjs";
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [offlinePlugin()],
  server: {
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.API_PORT || 3001}`,
        changeOrigin: false,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { react: ["react", "react-dom"], graphics: ["three"] },
      },
    },
  },
});
