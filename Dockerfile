# The build stage compiles the SPA and the proxy; the runtime only needs Node and the output files.
FROM node:22-alpine AS build
WORKDIR /app
ENV CI=true

RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# esbuild ships a prebuilt binary per platform, so skipping install scripts keeps the image reproducible.
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .
RUN pnpm run build && pnpm run build:server

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# dist-server/greenapi.mjs is already bundled, so the runtime installs nothing at all.
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY server.js ./server.js

RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]