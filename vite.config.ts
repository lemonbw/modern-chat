import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, loadEnv, type Plugin } from "vite";
import ogPreview from "./api/og.ts";
import greenApiProxy from "./api/greenapi/[method].ts";
import authEndpoint from "./api/auth.ts";

/** Vite has no serverless runtime, so the API endpoints run as middleware in development. */
const apiMiddleware = (): Plugin => ({
  name: "modern-chat-api",
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const url = request.url ?? "";
      const send = async (handler: (req: IncomingMessage, res: ServerResponse) => unknown) => {
        try {
          await handler(request as unknown as IncomingMessage, response as unknown as ServerResponse);
        } catch (error) {
          next(error as Error);
        }
      };
      if (url === "/api/auth" || url.startsWith("/api/auth?")) return void send(authEndpoint);
      if (url.startsWith("/api/greenapi/")) return void send(greenApiProxy);
      if (url.startsWith("/api/og")) return void send(ogPreview);
      return next();
    });
  },
});

const serverEnvKeys = ["GREEN_API_URL", "GREEN_API_INSTANCE", "GREEN_API_TOKEN", "APP_PASSWORD", "WRITE_PASSWORD", "SESSION_SECRET", "APP_ALLOW_WRITES"];

// The dev endpoints read process.env like the serverless functions do, so the values from .env
// are copied in here. The browser never sees them: nothing is prefixed with VITE_.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const key of serverEnvKeys) {
    if (env[key] !== undefined && process.env[key] === undefined) process.env[key] = env[key];
  }

  return {
    plugins: [react(), tailwindcss(), apiMiddleware()],
  };
});