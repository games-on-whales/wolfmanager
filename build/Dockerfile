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
# Temporary build-time secrets (will be auto-generated at runtime)
ENV NEXTAUTH_SECRET="build-time-secret-will-be-regenerated-at-runtime"
ENV ENCRYPTION_KEY="build-time-key-32chars-regenerated"

# Build the application
RUN pnpm run build

# Production stage
FROM node:20-slim AS runner

# Install system dependencies for runtime and native module compilation
RUN apt-get update && \
    apt-get install -y \
        gosu \
        ca-certificates \
        python3 \
        make \
        g++ \
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
ENV INSECURE_COOKIES_IN_PRODUCTION=false

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

# Install all dependencies first (needed for native module compilation)
RUN pnpm install --frozen-lockfile && \
    npm rebuild better-sqlite3 && \
    pnpm prune --prod && \
    pnpm cache clean && \
    npm cache clean --force && \
    apt-get remove -y python3 make g++ && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

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