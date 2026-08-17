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
RUN DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy npx prisma generate && npm run build

# Stage 3: Production image
FROM node:20-alpine AS production
# postgresql for EMBEDDED_DB=1, su-exec to drop to the postgres user, and
# busybox's nc/mountpoint for the start-up diagnosis. All small; the image only
# grows when the embedded mode is actually used, and having it always present
# means one image can be run either way.
RUN apk add --no-cache openssl postgresql16 postgresql16-client su-exec \
 && mkdir -p /var/lib/postgresql/data /run/postgresql \
 && chown -R postgres:postgres /var/lib/postgresql /run/postgresql
WORKDIR /app
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend/prisma ./prisma
COPY backend/package*.json ./
COPY backend/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh
# Frontend build output served as static files by Express
COPY --from=frontend-builder /app/frontend/dist ./public
EXPOSE 4000
# A script rather than an inline `until` loop: the old one never gave up, so an
# unreachable database spun until the platform's deploy timeout and the log said
# only "Timed Out". See the script for what it checks and why.
CMD ["./docker-entrypoint.sh"]
