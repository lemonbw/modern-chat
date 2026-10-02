import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv, type Plugin } from "vite";
import ogPreview from "./api/og.ts";

/** Vite has no serverless runtime, so the OpenGraph endpoint runs as middleware in development. */
const ogPreviewMiddleware = (): Plugin => ({
  name: "modern-chat-og-preview",
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      if (!request.url?.startsWith("/api/og")) return next();
      try {
        await ogPreview(request, response);
      } catch (error) {
        next(error as Error);
      }
    });
  },
});

// The dev server proxies /api/greenapi exactly like the serverless function does in production,
// so the token stays out of the browser bundle while local development keeps working.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = env.GREEN_API_URL?.replace(/\/$/, "");
  const instance = env.GREEN_API_INSTANCE;
  const token = env.GREEN_API_TOKEN;

  return {
    plugins: [react(), tailwindcss(), ogPreviewMiddleware()],
    server: {
      proxy: {
        ...(apiUrl && instance && token
          ? {
              "/api/greenapi": {
                target: apiUrl,
                changeOrigin: true,
                rewrite: (path) => {
                  const method = path.replace(/^\/api\/greenapi\//, "");
                  return `/waInstance${instance}/${method}/${token}`;
                },
              },
            }
          : {}),
      },
    },
  };
});