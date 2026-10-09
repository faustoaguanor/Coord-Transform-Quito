import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
// BASE_PATH permite publicar en GitHub Pages (/Coord-Transform-Quito/, valor
// por defecto) o en la raíz de un servidor propio (BASE_PATH=/, ver Dockerfile).
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH ?? "/Coord-Transform-Quito/",
  test: {
    environment: "node",
    include: ["src/**/*.test.{js,jsx}"],
  },
});
