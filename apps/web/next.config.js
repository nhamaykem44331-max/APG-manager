/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cho phép images từ các domain bên ngoài
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.kiwi.com', // Logo hãng bay
      },
    ],
  },

  // Proxy API calls đến NestJS backend
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
