# Use Node.js LTS version
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Add python and build tools for any native dependencies
RUN apk add --no-cache python3 make g++

# Set build arguments
ENV NODE_ENV=production
ENV VITE_APP_ENV=production

# Copy package files
COPY package*.json ./

# Install dependencies with verbose logging
RUN npm install

# Copy the rest of the application
COPY . .

# Build the application with detailed error output
RUN npm run build

# Expose port 3000
EXPOSE 3000

# Start the application using vite preview
CMD ["npm", "run", "start"] 