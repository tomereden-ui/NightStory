import HeroSection from "@/components/home/HeroSection";
import FeaturedSection from "@/components/home/FeaturedSection";
import QuickPickSection from "@/components/home/QuickPickSection";

export default function HomePage() {
  return (
    <div className="min-h-full" style={{ background: "#0A0C14" }}>
      <HeroSection />
      <FeaturedSection />
      <QuickPickSection />
    </div>
  );
}
