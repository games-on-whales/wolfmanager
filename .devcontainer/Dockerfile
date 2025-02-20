FROM mcr.microsoft.com/devcontainers/javascript-node:20

# Install additional OS packages
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    git \
    curl \
    wget \
    gnupg \
    ca-certificates \
    net-tools \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

# Install global npm packages
RUN npm install -g npm@latest && \
    npm install -g pnpm && \
    npm install -g @antfu/ni && \
    npm install -g typescript && \
    npm install -g prettier && \
    npm install -g eslint && \
    npm install -g postcss postcss-cli && \
    npm install -g tailwindcss && \
    npm install -g shadcn-ui

# Set up permissions for node user
RUN mkdir -p /home/node/.npm && chown -R node:node /home/node/.npm

# Handle docker group more flexibly
RUN DOCKER_GID=$(getent group docker | cut -d: -f3 || echo 999) && \
    if getent group docker > /dev/null 2>&1; then \
        if [ "$DOCKER_GID" != "999" ]; then \
            groupmod -g 999 docker || true; \
        fi \
    else \
        groupadd -g 999 docker; \
    fi && \
    usermod -aG docker node || true

# Switch to node user for security
USER node

# Set up working directory
WORKDIR /workspaces

# Create the project directory
RUN mkdir -p /workspaces/WolfUI
WORKDIR /workspaces/WolfUI

# Expose port 3000
EXPOSE 3000

# Create default package.json if none exists
RUN echo '{"name":"wolfui","version":"1.0.0","private":true}' > ./package.json

# Install project dependencies
RUN pnpm install || true && \
    npm rebuild bcrypt || true && \
    npm rebuild sharp || true

# Initialize shadcn-ui only if it hasn't been initialized yet
RUN if [ ! -f ".shadcn-ui/config.json" ]; then \
    npx shadcn-ui@latest init || true; \
    fi
