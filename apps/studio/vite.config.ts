import { createRequire } from "node:module";
import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";

const require = createRequire(import.meta.url);
const {
  STUDIO_DEV_PORT,
  STUDIO_IDENTITY_PATH,
  STUDIO_IDENTITY,
} = require("./dev-server-identity.cjs") as {
  STUDIO_DEV_PORT: number;
  STUDIO_IDENTITY_PATH: string;
  STUDIO_IDENTITY: string;
};

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    {
      name: "channel-foundry-studio-dev-identity",
      configureServer(server) {
        server.middlewares.use(STUDIO_IDENTITY_PATH, (_request, response) => {
          response.statusCode = 200;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.setHeader("Cache-Control", "no-store");
          response.setHeader("X-Channel-Foundry-Studio", STUDIO_IDENTITY);
          response.end(JSON.stringify({ app: STUDIO_IDENTITY }));
        });
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    port: STUDIO_DEV_PORT,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(fileURLToPath(new URL(".", import.meta.url)), "index.html"),
      },
    },
  },
});
