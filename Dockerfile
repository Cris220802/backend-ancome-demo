# syntax=docker/dockerfile:1.7

# ----------------------------------------------------------------------------
# Stage 1 — builder
# Compila TypeScript y copia las plantillas .hbs a dist/. Skippea la descarga
# de Chromium de Puppeteer (en runtime usamos el del sistema).
# ----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# Reduce node_modules a producción (descarga el set sin devDependencies).
RUN npm prune --omit=dev

# ----------------------------------------------------------------------------
# Stage 2 — runtime
# Imagen liviana con Chromium del sistema. Corre como usuario no-root.
# ----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

# Chromium + libs mínimas + fuentes para que el render del PDF se vea bien.
# dumb-init reenvía SIGTERM/SIGINT al proceso de Node para shutdown limpio
# (importante: sin él, los señales no llegan a Nest y Chromium puede quedar
# colgado al detener el contenedor).
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        chromium \
        ca-certificates \
        fonts-liberation \
        fonts-dejavu-core \
        fonts-noto-color-emoji \
        dumb-init \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Usuario no-root con grupos audio/video que Chromium usa por defecto.
RUN groupadd --system --gid 1001 app \
    && useradd --system --uid 1001 --gid app --groups audio,video --create-home app

COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/package.json ./package.json

USER app

EXPOSE 3000

# Healthcheck nativo: golpea /health (público, sin guard, sin throttler).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
