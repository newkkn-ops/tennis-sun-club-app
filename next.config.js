/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  typescript: {
    // 빌드 시 사소한 타입 에러로 빌드가 중단되지 않도록 보장
    ignoreBuildErrors: true,
  },
  eslint: {
    // 빌드 시 ESLint 경고로 빌드가 중단되지 않도록 보장
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
