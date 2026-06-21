const DB = "https://api.dicebear.com/9.x";

export interface SceneCharacter {
  label: string;
  url: string;   // DiceBear fallback URL
  glow: string;  // CSS color for glow ring + name label
  size: number;  // px
  x: string;     // CSS left (%)
  y: number;     // CSS top (px)
}

export const SCENE_CHARS: SceneCharacter[] = [
  { label: "Sparky",   url: `${DB}/pixel-art/svg?seed=TinyDragon-green-spark&backgroundColor=e8f5e9&radius=50`,           glow: "#10D9A0", size: 66, x: "1%",  y: 34 },
  { label: "Luna",     url: `${DB}/adventurer/svg?seed=Luna-star-child&backgroundColor=b6e3f4&radius=50`,                  glow: "#4fc3f7", size: 58, x: "16%", y: 8  },
  { label: "Merlin",   url: `${DB}/adventurer-neutral/svg?seed=StarWizard-white-beard&backgroundColor=1a237e&radius=50`,   glow: "#8B5CF6", size: 80, x: "32%", y: 18 },
  { label: "Fae",      url: `${DB}/adventurer/svg?seed=FairyFae-iridescent-wings&backgroundColor=f3e5f5&radius=50`,        glow: "#EC4899", size: 60, x: "55%", y: 4  },
  { label: "Celeste",  url: `${DB}/adventurer/svg?seed=MagicUnicorn-rainbow-mane&backgroundColor=fce4ec&radius=50`,        glow: "#F59E0B", size: 70, x: "70%", y: 22 },
  { label: "Sterling", url: `${DB}/adventurer-neutral/svg?seed=BraveKnight-silver-armor&backgroundColor=e3f2fd&radius=50`, glow: "#94A3B8", size: 56, x: "87%", y: 10 },
];
