# Local preview image. Mock data only: no secrets, no external services.
# ponytail: single stage with dev dependencies kept; switch to `output: "standalone"`
# and a multi-stage build when image size matters (real hosting).
FROM node:22-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && chown -R node:node /app

ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
