FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json ./
RUN npm install --omit=dev

FROM base AS build
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build:server
RUN npm run build:client

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY package.json ./
COPY docker/postgres/init.sql ./docker/postgres/init.sql

ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "npx drizzle-kit push --force 2>/dev/null || true; node dist-server/main.js"]
