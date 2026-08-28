import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: "site",
  publicDir: "public",
  build: {
    outDir: "../dist/site",
    emptyOutDir: true,
    target: "es2022",
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve(process.cwd(), "site/index.html"),
    },
  },
});
