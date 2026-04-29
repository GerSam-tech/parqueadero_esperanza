import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/parqueadero_esperanza/",
  server: {
    host: true, // permite acceso desde red/ngrok
    allowedHosts: [
      "antler-overstate-earthy.ngrok-free.dev"
    ]
  }
});