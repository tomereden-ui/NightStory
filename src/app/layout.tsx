import type { Metadata, Viewport } from "next";
import { Inter, Outfit, Rubik } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/context/LanguageContext";
import { ViewModeProvider } from "@/context/ViewModeContext";
import { FontSizeProvider } from "@/context/FontSizeContext";
import { AuthProvider } from "@/context/AuthContext";
import { UnsavedChangesProvider } from "@/context/UnsavedChangesContext";
import AppShell from "@/components/layout/AppShell";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
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
    <html lang="en" dir="ltr" className={`${inter.variable} ${outfit.variable} ${rubik.variable}`}>
      <body className="min-h-screen antialiased" style={{ background: "#0A0C14" }}>
        <AuthProvider>
          <LanguageProvider>
            <ViewModeProvider>
              <FontSizeProvider>
                <UnsavedChangesProvider>
                  <AppShell>{children}</AppShell>
                </UnsavedChangesProvider>
              </FontSizeProvider>
            </ViewModeProvider>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
