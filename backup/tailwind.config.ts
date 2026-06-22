import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#080B18",
          card: "#0E1225",
          elevated: "#131729",
          border: "#1E2440",
        },
        teal: {
          DEFAULT: "#00D4FF",
          dark: "#00A8CC",
          glow: "rgba(0,212,255,0.15)",
        },
        purple: {
          DEFAULT: "#8B5CF6",
          bright: "#A78BFA",
          dark: "#6D28D9",
          glow: "rgba(139,92,246,0.15)",
        },
        pink: {
          DEFAULT: "#EC4899",
          glow: "rgba(236,72,153,0.15)",
        },
        navy: {
          DEFAULT: "#080B18",
          light: "#0E1225",
          lighter: "#131729",
          card: "#0E1225",
        },
        gold: {
          DEFAULT: "#F5C842",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        hebrew: ["var(--font-rubik)", "sans-serif"],
      },
      backgroundImage: {
        "app-gradient": "linear-gradient(160deg, #0D0F1E 0%, #080B18 60%, #0A0D1C 100%)",
        "card-gradient": "linear-gradient(135deg, #0E1225 0%, #080B18 100%)",
        "teal-gradient": "linear-gradient(135deg, #00D4FF 0%, #0094B3 100%)",
        "purple-gradient": "linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)",
        "vivid-gradient": "linear-gradient(135deg, #00D4FF 0%, #8B5CF6 50%, #EC4899 100%)",
        "story-gradient": "linear-gradient(180deg, transparent 30%, rgba(8,11,24,0.95) 100%)",
      },
      boxShadow: {
        teal: "0 0 24px rgba(0,212,255,0.25)",
        "teal-sm": "0 0 12px rgba(0,212,255,0.15)",
        purple: "0 0 24px rgba(139,92,246,0.3)",
        "purple-sm": "0 0 12px rgba(139,92,246,0.2)",
        card: "0 4px 32px rgba(0,0,0,0.5)",
        glow: "0 0 40px rgba(139,92,246,0.2), 0 0 80px rgba(0,212,255,0.1)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        twinkle: "twinkle 2s ease-in-out infinite",
        "float-up": "floatUp 0.6s ease-out forwards",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        twinkle: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.3", transform: "scale(0.7)" },
        },
        floatUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
