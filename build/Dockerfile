FROM node:20-slim AS builder

# Install pnpm globally and create directories early
RUN npm install -g pnpm && \
    mkdir -p /app

WORKDIR /app

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install all dependencies (including dev) for build
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build-time environment variables
ENV NODE_ENV=production
ENV NEXTAUTH_SECRET="build-time-secret-will-be-regenerated-at-runtime"
ENV ENCRYPTION_KEY="build-time-key-32chars-regenerated"

# Build the application
RUN pnpm run build

# Production stage
FROM node:20-slim AS runner

# Install system dependencies for runtime
RUN apt-get update && \
    apt-get install -y \
        gosu \
        ca-certificates \
        && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get clean

# Create app directory and set proper ownership
WORKDIR /app

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV PUID=1000
ENV PGID=1000
ENV UNAME=node

# Install pnpm in production stage
RUN npm install -g pnpm

# Copy built application with proper ownership (done as root)
COPY --from=builder --chown=root:root /app/package.json ./package.json
COPY --from=builder --chown=root:root /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder --chown=root:root /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder --chown=root:root /app/next.config.js ./next.config.js
COPY --from=builder --chown=root:root /app/src ./src
COPY --from=builder --chown=root:root /app/public ./public
COPY --from=builder --chown=root:root /app/.next ./.next

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile && \
    pnpm cache clean && \
    npm cache clean --force

# Copy initialization scripts
COPY build/scripts/ /opt/wolf/scripts/
COPY build/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Make scripts executable
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && \
    chmod +x /opt/wolf/scripts/*.sh

# Create necessary directories that will need permission fixes
RUN mkdir -p /app/config /app/config/logs /app/logs

# Expose port
EXPOSE 3000

# Start as root, fix permissions, then drop to node user
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["pnpm", "start"]