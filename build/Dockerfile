FROM node:20-slim AS builder

# Install pnpm globally
RUN npm install -g pnpm

WORKDIR /app

# Copy pnpm lock files along with package.json
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install

COPY . .

# Add build-time environment variables for NextAuth and encryption
ENV NODE_ENV=production
ENV NEXTAUTH_SECRET="build-time-secret-will-be-regenerated-at-runtime"
ENV ENCRYPTION_KEY="build-time-key-32chars-regenerated"

RUN pnpm run build

FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Use the existing node user from the base image
# Copy all necessary files (not using standalone mode)
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder --chown=node:node /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder --chown=node:node /app/next.config.js ./next.config.js

# Copy source and build files
COPY --from=builder --chown=node:node /app/src ./src
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next ./.next

# Install production dependencies (before switching to node user)
RUN npm install -g pnpm && pnpm install --prod

# CRITICAL: Create config directory with proper permissions AFTER deps but BEFORE switching users
RUN mkdir -p /app/config && chown -R node:node /app/config

# Copy and setup entrypoint script
COPY build/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# IMPORTANT: Switch to node user LAST, after all permission setup
USER node

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["pnpm", "start"]