import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Honour an externally assigned port (e.g. preview tooling sets PORT).
  server: process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : undefined,
});
