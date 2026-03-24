# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 2: Build backend
FROM node:20-alpine AS backend-builder
RUN apk add --no-cache openssl
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ .
RUN npx prisma generate && npm run build

# Stage 3: Production image
FROM node:20-alpine AS production
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend/prisma ./prisma
COPY backend/package*.json ./
# Frontend build output served as static files by Express
COPY --from=frontend-builder /app/frontend/dist ./public
EXPOSE 4000
CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
