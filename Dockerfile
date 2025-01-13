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

# Create tsconfig.json if it doesn't exist
RUN if [ ! -f tsconfig.json ]; then \
    echo '{ \
      "compilerOptions": { \
        "target": "ESNext", \
        "useDefineForClassFields": true, \
        "lib": ["DOM", "DOM.Iterable", "ESNext"], \
        "allowJs": false, \
        "skipLibCheck": true, \
        "esModuleInterop": false, \
        "allowSyntheticDefaultImports": true, \
        "strict": true, \
        "forceConsistentCasingInFileNames": true, \
        "module": "ESNext", \
        "moduleResolution": "Node", \
        "resolveJsonModule": true, \
        "isolatedModules": true, \
        "noEmit": true, \
        "jsx": "react-jsx" \
      }, \
      "include": ["src"], \
      "references": [{ "path": "./tsconfig.node.json" }] \
    }' > tsconfig.json; \
    fi

# Create tsconfig.node.json if it doesn't exist
RUN if [ ! -f tsconfig.node.json ]; then \
    echo '{ \
      "compilerOptions": { \
        "composite": true, \
        "module": "ESNext", \
        "moduleResolution": "Node", \
        "allowSyntheticDefaultImports": true \
      }, \
      "include": ["vite.config.ts"] \
    }' > tsconfig.node.json; \
    fi

# Debug: List contents and check versions
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