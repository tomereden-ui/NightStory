/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [],
  },
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  // Next.js 14 equivalent of serverExternalPackages (promoted to stable in v15)
  experimental: {
    serverComponentsExternalPackages: ["ffmpeg-static", "fluent-ffmpeg"],
  },
};

export default nextConfig;
