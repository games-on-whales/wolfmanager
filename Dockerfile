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

# Build the application
RUN npm run build

# Expose port 9971
EXPOSE 9971

# Start the application
CMD ["npm", "start"] 