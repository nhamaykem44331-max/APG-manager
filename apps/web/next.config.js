const apiBaseUrl = (
  process.env.API_INTERNAL_URL
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? 'http://localhost:3001/api/v1'
).replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.kiwi.com',
      },
    ],
  },

  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      return [];
    }

    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiBaseUrl}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
