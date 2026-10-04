/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        source: '/__/auth/:path*',
        destination: 'https://unfract-prod.firebaseapp.com/__/auth/:path*',
      },
    ];
  },
};

export default nextConfig;
