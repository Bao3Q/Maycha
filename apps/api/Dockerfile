# ---------- Build ----------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN export DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public" \
    && npm run build \
    && npm prune --omit=dev

# ---------- Run ----------
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
EXPOSE 3001
USER node
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main"]
