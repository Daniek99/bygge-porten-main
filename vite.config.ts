import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "127.0.0.1", // Bind to localhost only
    port: 8081, // Your preferred port
    allowedHosts: [
      "wired-accepted-gecko.ngrok-free.app",
      "*.ngrok-free.app",
      "localhost",
      "127.0.0.1"
    ],
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
