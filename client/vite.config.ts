import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  root: "client",
  build: { outDir: "../public/app", emptyOutDir: true },
  plugins: [react()],
});
