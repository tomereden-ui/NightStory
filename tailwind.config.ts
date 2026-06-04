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
        navy: {
          DEFAULT: "#0D1B2E",
          light: "#142338",
          lighter: "#1A2F4A",
          card: "#112035",
        },
        gold: {
          DEFAULT: "#F5C842",
          light: "#F8D76A",
          dark: "#D4A820",
          muted: "#F5C84233",
        },
        star: "#FFE57A",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        hebrew: ["var(--font-rubik)", "sans-serif"],
      },
      backgroundImage: {
        "night-gradient": "linear-gradient(180deg, #0D1B2E 0%, #0A1520 100%)",
        "card-gradient": "linear-gradient(135deg, #142338 0%, #0D1B2E 100%)",
        "gold-gradient": "linear-gradient(135deg, #F5C842 0%, #D4A820 100%)",
      },
      boxShadow: {
        gold: "0 0 20px rgba(245, 200, 66, 0.3)",
        "gold-sm": "0 0 10px rgba(245, 200, 66, 0.2)",
        card: "0 4px 24px rgba(0, 0, 0, 0.4)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        twinkle: "twinkle 2s ease-in-out infinite",
        "float-up": "floatUp 0.8s ease-out forwards",
      },
      keyframes: {
        twinkle: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.4", transform: "scale(0.8)" },
        },
        floatUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
