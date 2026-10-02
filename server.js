import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const distDir = resolve(root, "dist");
const port = Number(process.env.PORT ?? 3000);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const proxy = await import("./dist-server/greenapi.mjs");
const auth = await import("./dist-server/auth.mjs");
const ogPreview = await import("./dist-server/og.mjs");

const sendFile = (response, filePath, statusCode = 200) => {
  response.statusCode = statusCode;
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Content-Type", contentTypes[extname(filePath)] ?? "application/octet-stream");
  response.setHeader("Cache-Control", filePath.includes(`${sep}assets${sep}`) ? "public, max-age=31536000, immutable" : "no-cache");
  createReadStream(filePath).pipe(response);
};

// `blob:` covers recorded voice messages.

const contentSecurityPolicy = [
  "default-src 'self'",
  "img-src 'self' data: blob: https: http:",
  "media-src 'self' blob: https: http:",
  "connect-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = (response) => {
  response.setHeader("Content-Security-Policy", contentSecurityPolicy);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
};

/** Serves the built SPA and forwards the API calls to the same proxy GREEN-API uses. */
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  securityHeaders(response);

  if (url.pathname === "/api/health") {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname === "/api/auth") {
    try {
      await auth.default(request, response);
    } catch (error) {
      if (!response.headersSent) {
        response.statusCode = 500;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Auth error" }));
      } else {
        response.end();
      }
    }
    return;
  }

  if (url.pathname.startsWith("/api/greenapi/")) {
    try {
      await proxy.default(request, response);
    } catch (error) {
      if (!response.headersSent) {
        response.statusCode = 500;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Proxy error" }));
      } else {
        response.end();
      }
    }
    return;
  }

  if (url.pathname === "/api/og") {
    try {
      await ogPreview.default(request, response);
    } catch {
      if (!response.headersSent) {
        response.statusCode = 500;
        response.end(JSON.stringify({ error: "Preview failed" }));
      }
    }
    return;
  }

  // Resolve inside dist only, so a crafted path cannot read the rest of the image.
  const candidate = resolve(distDir, `.${normalize(url.pathname)}`);
  const isInside = candidate === distDir || candidate.startsWith(distDir + "/");
  if (!isInside) {
    response.statusCode = 403;
    response.end("Forbidden");
    return;
  }

  if (existsSync(candidate) && statSync(candidate).isFile()) {
    sendFile(response, candidate);
    return;
  }

  const indexFile = join(distDir, "index.html");
  if (existsSync(indexFile)) {
    sendFile(response, indexFile);
    return;
  }

  response.statusCode = 404;
  response.end("Not found");
});

server.listen(port, () => {
  console.log(`Modern Chat is running on http://0.0.0.0:${port}`);
});