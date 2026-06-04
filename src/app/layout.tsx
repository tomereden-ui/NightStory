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
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={`${inter.variable} ${rubik.variable}`}>
      <body className="min-h-screen bg-bg antialiased">
        <LanguageProvider>
          <div className="flex flex-col min-h-screen max-w-md mx-auto relative bg-app-gradient">
            <main className="flex-1 pb-24 overflow-x-hidden">{children}</main>
            <BottomNav />
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
