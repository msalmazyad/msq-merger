import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// For GitHub Pages: set VITE_BASE to your repo name when deploying.
// E.g. if the repo is github.com/you/msq-merger, set base to "/msq-merger/".
const base = process.env.VITE_BASE || "/";

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
