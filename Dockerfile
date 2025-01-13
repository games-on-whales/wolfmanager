# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Debug: List contents and check TypeScript
RUN ls -la && \
    npm list typescript && \
    echo "Node version: $(node -v)" && \
    echo "NPM version: $(npm -v)"

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Install production dependencies only
RUN npm install --production

# Expose port 3000
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"] 