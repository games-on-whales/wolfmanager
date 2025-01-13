FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install build essentials
RUN apk add --no-cache python3 make g++

# Copy package files first
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm install

# Copy the rest of the application
COPY . .

# Create vite.config.ts if it doesn't exist
RUN if [ ! -f vite.config.ts ]; then \
    echo 'import { defineConfig } from "vite"; \
    import react from "@vitejs/plugin-react"; \
    export default defineConfig({ \
      plugins: [react()], \
      server: { port: 3000, host: true }, \
      preview: { port: 3000, host: true } \
    });' > vite.config.ts; \
    fi

# Build the application
RUN npm run build

# Expose port 3000
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"] 