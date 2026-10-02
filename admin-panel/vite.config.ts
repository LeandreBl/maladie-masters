import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    host: "0.0.0.0", // bind on all interfaces (WSL2 → Windows access)
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Firebase weighs more than the rest of the panel: keeping it out of
        // the main chunk spares a re-download on every panel deploy.
        manualChunks: {
          firebase: ["firebase/app", "firebase/auth"],
          react: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
});
