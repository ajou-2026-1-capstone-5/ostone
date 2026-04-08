import { fileURLToPath } from "url";
import path from "path";
import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    environment: "jsdom",
  },
});
