# Multi-stage production build for Vathmos on Google Cloud Run
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies (including devDependencies required for build)
RUN npm ci

# Copy project source code
COPY . .

# Build Vite client (dist/) and bundle Express server (dist/server.cjs)
RUN npm run build

# Production runner stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled bundles from builder stage
COPY --from=builder /app/dist ./dist

# Non-root security user
USER node

# Expose Cloud Run default port
EXPOSE 8080

# Launch server
CMD ["node", "dist/server.cjs"]
