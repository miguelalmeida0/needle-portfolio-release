FROM node:26.0.0-bookworm-slim@sha256:3529ef69feecddd94e9c5ecd3d25a96f2f23ea40661f494f932ae2b12ab1977c
WORKDIR /app
ENV NODE_ENV=production PORT=8000 NEEDLE_IMAGE_CACHE_ROOT=/app/.needle-cache/derivatives
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --chown=node:node dist ./dist
COPY --chown=node:node data-packs ./data-packs
COPY --chown=node:node scripts ./scripts
COPY prepare-previews.mjs ./prepare-previews.mjs
COPY LICENSE THIRD_PARTY_NOTICES.md ./
RUN mkdir -p /app/.needle-cache/derivatives && chown -R node:node /app/.needle-cache
USER node
RUN node scripts/assemble-release.mjs && node prepare-previews.mjs
EXPOSE 8000
CMD ["node", "scripts/serve.mjs", "--root", "dist", "--packs", "data-packs", "--host", "0.0.0.0"]
