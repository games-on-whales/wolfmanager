/** @type {import('next').NextConfig} */

// Define security headers
const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "origin-when-cross-origin",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig = {
  distDir: ".next",
  experimental: {
    // Enable instrumentation for server startup hooks
    instrumentationHook: true,
  },
  // Skip ESLint during build to avoid lint errors blocking production builds
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Add security headers configuration
  async headers() {
    return [
      {
        // Apply these headers to all routes
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Add alias for @
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": "./src",
    };

    // Add rule to handle .node files using node-loader
    config.module.rules.push({
      test: /\.node$/,
      use: "node-loader",
    });

    // If it's a server-side build, add ssh2 to externals
    if (isServer) {
      // Handle externals properly - it could be an array, function, or object
      if (Array.isArray(config.externals)) {
        config.externals.push('ssh2');
      } else if (typeof config.externals === 'function') {
        const originalExternals = config.externals;
        config.externals = (context, request, callback) => {
          if (request === 'ssh2') {
            return callback(null, 'commonjs ssh2');
          }
          return originalExternals(context, request, callback);
        };
      } else if (typeof config.externals === 'object') {
        config.externals = {
          ...config.externals,
          'ssh2': 'commonjs ssh2'
        };
      } else {
        // If externals is undefined or something else, initialize as array
        config.externals = ['ssh2'];
      }
    }

    // Ignore cpu-features module for server-side builds, as it's likely not needed for socket connections
    // and causes build issues with its native addon.
    // Reverting the IgnorePlugin change. We need to address the native addon build issues directly.
    // The above externals change for ssh2 should handle this.

    return config;
  },
};

module.exports = nextConfig;
