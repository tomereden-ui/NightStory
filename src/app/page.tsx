import HeroSection from "@/components/home/HeroSection";
import FeaturedSection from "@/components/home/FeaturedSection";
import RecentSection from "@/components/home/RecentSection";
import QuickPickSection from "@/components/home/QuickPickSection";

export default function HomePage() {
  return (
    <div className="bg-night-gradient min-h-full">
      <HeroSection />
      <FeaturedSection />
      <RecentSection />
      <QuickPickSection />
    </div>
  );
}
