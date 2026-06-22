/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [],
  },
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  experimental: {
    // Prevent webpack from bundling server-only native binaries (Next.js 14 syntax)
    serverComponentsExternalPackages: ["ffmpeg-static", "fluent-ffmpeg"],
  },
};

export default nextConfig;
