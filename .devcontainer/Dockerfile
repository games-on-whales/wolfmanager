FROM mcr.microsoft.com/devcontainers/javascript-node:20

# Install additional OS packages and Docker CLI
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    git \
    curl \
    wget \
    gnupg \
    ca-certificates \
    net-tools \
    lsb-release \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null \
    && apt-get update \
    && apt-get -y install --no-install-recommends docker-ce-cli docker-buildx-plugin docker-compose-plugin \
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

# Create docker group with a reasonable default GID and add node user
RUN groupadd -g 999 docker || true && \
    usermod -aG docker node || true && \
    # Ensure Docker buildx is available
    mkdir -p /home/node/.docker/cli-plugins && \
    chown -R node:node /home/node/.docker

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
