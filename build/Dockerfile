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

# Create a non-root user with matching user and group names
RUN addgroup --system --gid 1000 wolfmanager
RUN adduser --system --uid 1000 --gid 1000 wolfmanager

# Copy all necessary files (not using standalone mode)
COPY --from=builder --chown=wolfmanager:wolfmanager /app/package.json ./package.json
COPY --from=builder --chown=wolfmanager:wolfmanager /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder --chown=wolfmanager:wolfmanager /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder --chown=wolfmanager:wolfmanager /app/next.config.js ./next.config.js

# Copy source and build files
COPY --from=builder --chown=wolfmanager:wolfmanager /app/src ./src
COPY --from=builder --chown=wolfmanager:wolfmanager /app/public ./public
COPY --from=builder --chown=wolfmanager:wolfmanager /app/.next ./.next

# Install production dependencies
RUN npm install -g pnpm && pnpm install --prod

USER wolfmanager

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["pnpm", "start"]