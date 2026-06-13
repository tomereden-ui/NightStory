export interface WorldOption {
  id: string;
  label: string;
  emoji: string;
}

export const WORLD_OPTIONS: WorldOption[] = [
  { id: "deep-ocean",       label: "Deep ocean",       emoji: "🌊" },
  { id: "enchanted-forest", label: "Enchanted forest", emoji: "🌳" },
  { id: "space-station",    label: "Space station",    emoji: "🚀" },
  { id: "candy-kingdom",    label: "Candy kingdom",    emoji: "🍬" },
  { id: "cloud-village",    label: "Cloud village",    emoji: "☁️" },
  { id: "underground-caves",label: "Underground caves",emoji: "🕳️" },
  { id: "snowy-mountains",  label: "Snowy mountains",  emoji: "🏔️" },
  { id: "desert-oasis",     label: "Desert oasis",     emoji: "🌴" },
];
