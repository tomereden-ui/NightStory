/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@supabase/ssr"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "flagcdn.com" },
    ],
  },
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  experimental: {
    // Prevent webpack from bundling server-only native binaries (Next.js 14 syntax)
    serverComponentsExternalPackages: ["ffmpeg-static", "fluent-ffmpeg", "sharp"],
  },
};

export default nextConfig;
