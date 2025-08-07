// client/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = __dirname; // absolute path to /client

export default defineConfig({
  root,                          // <-- tell Vite the project root is /client
  plugins: [react()],
  build: {
    outDir: path.resolve(root, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      // explicitly point to /client/index.html
      input: path.resolve(root, "index.html"),
    },
  },
});
