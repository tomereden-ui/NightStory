import type { Metadata, Viewport } from "next";
import { Inter, Rubik } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/context/LanguageContext";
import BottomNav from "@/components/navigation/BottomNav";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const rubik = Rubik({ subsets: ["latin", "hebrew"], variable: "--font-rubik", display: "swap" });

export const metadata: Metadata = {
  title: "NightStory – Magical Audio Stories for Kids",
  description: "Immersive bedtime stories narrated by AI voices. Calming, magical, and made for little dreamers.",
  keywords: ["children stories", "audio stories", "bedtime", "kids", "Hebrew"],
  authors: [{ name: "NightStory" }],
};

export const viewport: Viewport = {
  themeColor: "#080B18",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={`${inter.variable} ${rubik.variable}`}>
      <body className="min-h-screen antialiased" style={{ background: "#0A0C14" }}>
        <LanguageProvider>
          <div className="flex flex-col md:flex-row min-h-screen relative" style={{ background: "#0A0C14" }}>
            <BottomNav />
            <main className="flex-1 pb-24 md:pb-8 overflow-x-hidden">
              <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto md:px-6 md:py-6">
                {children}
              </div>
            </main>
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
