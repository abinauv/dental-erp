const createNextIntlPlugin = require('next-intl/plugin')

// Locale comes from the clinic record, not the URL, so there is no routing
// config here — just the pointer to the request config. See docs/LOCALIZATION.md.
const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Production optimizations
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  // Ignore TypeScript errors in test files during build
  typescript: {
    ignoreBuildErrors: false,
  },
  // Logging
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
  // CORS for mobile app
  async headers() {
    return [
      {
        // CORS headers for API routes (mobile app access)
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, Cookie, X-CSRF-Token',
          },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
        ],
      },
      {
        // Security headers for all routes
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
        ],
      },
    ]
  },
}

module.exports = withNextIntl(nextConfig)
