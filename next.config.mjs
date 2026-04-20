/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['https://2d8981c9-f99d-4043-8880-85049be7b28c-00-z27w62z5pzs8.pike.replit.dev'],
};

export default nextConfig;
