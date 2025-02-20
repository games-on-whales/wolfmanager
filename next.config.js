/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  distDir: ".next",
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": "/workspaces/WolfUI/src",
    };
    return config;
  },
};

module.exports = nextConfig;
