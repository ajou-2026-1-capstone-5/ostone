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
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    environment: "jsdom",
    testTimeout: 10000,
    hookTimeout: 10000,
    coverage: {
      provider: "v8",
      reporter: ["lcov", "text"],
      exclude: ["node_modules/", "dist/", "**/*.d.ts", "**/generated/**"],
    },
  },
});
