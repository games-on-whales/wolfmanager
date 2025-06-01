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

COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"] 