/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets an isolated dev server (e.g. an assistant's preview session) build
  // into its own directory via NEXT_DIST_DIR, so it never shares webpack's
  // persistent cache with whatever `next dev` you're already running --
  // two processes writing the same .next/cache/webpack/* concurrently is a
  // real, observed cause of "__webpack_modules__[moduleId] is not a
  // function" crashes. Unset, this is identical to today (plain ".next").
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
