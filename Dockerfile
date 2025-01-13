# Use Node.js LTS version
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Add build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    bash \
    nodejs \
    npm

# Set build arguments
ENV NODE_ENV=production
ENV VITE_APP_ENV=production

# Copy package files
COPY package*.json ./

# Clear npm cache and install dependencies
RUN npm cache clean --force && \
    npm install

# Copy the rest of the application
COPY . .

# Verify TypeScript installation
RUN npm list typescript || npm install typescript

# Build the application
RUN npm run build

# Expose port 3000
EXPOSE 3000

# Start the application using vite preview
CMD ["npm", "run", "start"] 