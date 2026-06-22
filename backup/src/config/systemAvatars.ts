export interface SystemAvatar {
  id: string;
  label: string;
  category: "child" | "adult" | "animal" | "fantasy" | "magical";
  emoji: string;
  url: string;    // DiceBear fallback — loads instantly
  prompt?: string; // Portrait prompt for AI seeding (human/fantasy only)
}

const DB = "https://api.dicebear.com/9.x";

function adv(seed: string, bg: string) {
  return `${DB}/adventurer/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${bg}&radius=50`;
}
function advN(seed: string, bg: string) {
  return `${DB}/adventurer-neutral/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${bg}&radius=50`;
}
function emoji(seed: string, bg: string) {
  return `${DB}/fun-emoji/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${bg}&radius=50`;
}
function pixel(seed: string, bg: string) {
  return `${DB}/pixel-art/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${bg}&radius=50`;
}
function lorelei(seed: string, bg: string) {
  return `${DB}/lorelei-neutral/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${bg}&radius=50`;
}

const P = "illustrated portrait, soft cinematic lighting, painterly digital art, dreamy children's book quality, gentle expression";

export const SYSTEM_AVATARS: SystemAvatar[] = [
  // ── Children ─────────────────────────────────────────────────────────────────
  { id: "child-girl-stars",    label: "Luna",   category: "child", emoji: "⭐", url: adv("Luna-star-child",      "b6e3f4"), prompt: `young girl with dark eyes and a glowing star crown, soft blue starry background, ${P}` },
  { id: "child-boy-adventure", label: "Finn",   category: "child", emoji: "🧭", url: adv("Finn-explorer",        "ffd5dc"), prompt: `adventurous young boy explorer with curious bright eyes, warm pink background, ${P}` },
  { id: "child-girl-artist",   label: "Mia",    category: "child", emoji: "🎨", url: adv("Mia-artist-paint",     "c0aede"), prompt: `creative young girl with paint-stained hands and bright smile, lavender background, ${P}` },
  { id: "child-boy-reader",    label: "Leo",    category: "child", emoji: "📚", url: adv("Leo-bookworm",         "b6e3f4"), prompt: `bookworm boy with round glasses and kind eyes, soft blue background, warm reading light, ${P}` },
  { id: "child-girl-dancer",   label: "Bella",  category: "child", emoji: "🩰", url: adv("Bella-dancer-tutu",    "ffd5dc"), prompt: `graceful young ballerina girl with hair bun and soft smile, rosy pink background, ${P}` },
  { id: "child-boy-science",   label: "Max",    category: "child", emoji: "🔬", url: adv("Max-science-goggles",  "c0aede"), prompt: `enthusiastic young scientist boy with safety goggles, lavender background, ${P}` },
  { id: "child-girl-nature",   label: "Lily",   category: "child", emoji: "🌸", url: adv("Lily-flowers-nature",  "d4edda"), prompt: `gentle nature-loving girl with flowers woven in her hair, soft green background, ${P}` },
  { id: "child-boy-pilot",     label: "Jay",    category: "child", emoji: "✈️", url: adv("Jay-pilot-aviator",   "b6d4f4"), prompt: `cheerful young boy pilot with aviator goggles and scarf, light blue sky background, ${P}` },
  { id: "child-girl-chef",     label: "Rosa",   category: "child", emoji: "👩‍🍳", url: adv("Rosa-chef-baker",   "ffe4c4"), prompt: `cheerful young chef girl with tiny white apron and flour on her nose, warm peach background, ${P}` },
  { id: "child-boy-music",     label: "Sam",    category: "child", emoji: "🎸", url: adv("Sam-guitar-music",    "ffd5dc"), prompt: `musical boy with colorful headphones and joyful bright eyes, rosy background, ${P}` },
  { id: "child-girl-magic",    label: "Zoe",    category: "child", emoji: "✨", url: adv("Zoe-magic-wand",      "e8d4f5"), prompt: `magical girl with sparkling wand and glowing violet eyes, soft purple background, ${P}` },
  { id: "child-toddler-bear",  label: "Teddy",  category: "child", emoji: "🧸", url: adv("Teddy-bear-pajamas", "ffe4c4"), prompt: `adorable toddler in bear-eared pajamas with rosy chubby cheeks, warm peach background, ${P}` },

  // ── Adults ────────────────────────────────────────────────────────────────────
  { id: "adult-mom-warm",          label: "Mom",     category: "adult", emoji: "💝", url: adv("Mom-warm-caring",        "ffdfbf"), prompt: `warm loving mother with gentle smile and kind eyes, soft golden background, ${P}` },
  { id: "adult-dad-beard",         label: "Dad",     category: "adult", emoji: "🌟", url: advN("Dad-beard-sweater",     "d1f4cc"), prompt: `friendly bearded father with warm smile and steady gaze, soft green background, ${P}` },
  { id: "adult-grandma-kind",      label: "Grandma", category: "adult", emoji: "🌺", url: adv("Grandma-white-hair",     "ffe4e1"), prompt: `kind white-haired grandmother with gentle smile and rosy cheeks, soft pink background, ${P}` },
  { id: "adult-grandpa-wise",      label: "Grandpa", category: "adult", emoji: "🎩", url: advN("Grandpa-silver-wise",   "e1f0ff"), prompt: `wise silver-haired grandfather with distinguished kind eyes, soft blue background, ${P}` },
  { id: "adult-teacher-bright",    label: "Teacher", category: "adult", emoji: "🍎", url: adv("Teacher-glasses-bright", "fff3cd"), prompt: `enthusiastic teacher with glasses and bright encouraging smile, warm yellow background, ${P}` },
  { id: "adult-chef-jolly",        label: "Chef",    category: "adult", emoji: "🍳", url: advN("Chef-toque-jolly",      "ffdfbf"), prompt: `jolly chef with white toque hat and cheerful expression, warm peach background, ${P}` },
  { id: "adult-scientist-curious", label: "Dr. Ray", category: "adult", emoji: "🔭", url: adv("DrRay-lab-coat-curly",   "d4f5f5"), prompt: `curious scientist in lab coat with thoughtful intelligent eyes, teal blue background, ${P}` },
  { id: "adult-musician-cool",     label: "Jazz",    category: "adult", emoji: "🎵", url: advN("Jazz-headphones-cool",  "e8e4f5"), prompt: `cool musician with over-ear headphones and relaxed confident look, purple background, ${P}` },

  // ── Animals — pixel-art, no portrait seeding ─────────────────────────────────
  { id: "animal-fox-clever",     label: "Foxy",   category: "animal", emoji: "🦊", url: pixel("CleverFox-orange-amber",  "fff3e0") },
  { id: "animal-owl-wise",       label: "Ollie",  category: "animal", emoji: "🦉", url: pixel("WiseOwl-graduation-cap",  "fff9e0") },
  { id: "animal-rabbit-fluffy",  label: "Bun",    category: "animal", emoji: "🐰", url: pixel("FluffyRabbit-pink-nose",  "fce4ec") },
  { id: "animal-bear-honey",     label: "Baloo",  category: "animal", emoji: "🐻", url: pixel("HoneyBear-golden-brown",  "fff3cd") },
  { id: "animal-cat-magic",      label: "Mystic", category: "animal", emoji: "🐱", url: pixel("MysticCat-purple-eyes",   "ede7f6") },
  { id: "animal-dog-loyal",      label: "Buddy",  category: "animal", emoji: "🐶", url: pixel("LoyalDog-golden-floppy",  "fff9c4") },
  { id: "animal-dragon-tiny",    label: "Sparky", category: "animal", emoji: "🐉", url: pixel("TinyDragon-green-spark",  "e8f5e9") },
  { id: "animal-penguin-dapper", label: "Pip",    category: "animal", emoji: "🐧", url: pixel("DapperPenguin-bowtie",    "e3f2fd") },
  { id: "animal-panda-chill",    label: "Bamboo", category: "animal", emoji: "🐼", url: pixel("ChillPanda-bamboo",       "f1f8e9") },
  { id: "animal-deer-gentle",    label: "Dew",    category: "animal", emoji: "🦌", url: pixel("GentleDeer-velvet",       "fbe9e7") },
  { id: "animal-parrot-colorful",label: "Rio",    category: "animal", emoji: "🦜", url: pixel("ColorfulParrot-tropical", "e0f7fa") },
  { id: "animal-hedgehog-cute",  label: "Quill",  category: "animal", emoji: "🦔", url: pixel("CuteHedgehog-backpack",   "fff3e0") },

  // ── Fantasy — portrait seeding ────────────────────────────────────────────────
  { id: "fantasy-fairy-wings",    label: "Fae",      category: "fantasy", emoji: "🧚",    url: adv("FairyFae-iridescent-wings",    "f3e5f5"), prompt: `beautiful fairy with iridescent wings and softly glowing skin, purple magical background, ethereal fantasy ${P}` },
  { id: "fantasy-wizard-stars",   label: "Merlin",   category: "fantasy", emoji: "🧙",    url: advN("StarWizard-white-beard",      "1a237e"), prompt: `wise old wizard with long white beard and star-covered robes, deep blue magical background, epic fantasy ${P}` },
  { id: "fantasy-elf-forest",     label: "Elara",    category: "fantasy", emoji: "🧝",    url: adv("ForestElf-pointed-ears",       "e8f5e9"), prompt: `graceful forest elf with pointed ears and bright green eyes, soft forest green background, detailed fantasy ${P}` },
  { id: "fantasy-mermaid-waves",  label: "Marina",   category: "fantasy", emoji: "🧜",    url: adv("OceanMermaid-teal-scales",     "e0f7fa"), prompt: `beautiful mermaid with iridescent teal scales and flowing hair, ocean blue background, dreamy fantasy ${P}` },
  { id: "fantasy-gnome-garden",   label: "Gnomeo",   category: "fantasy", emoji: "🍄",    url: advN("GardenGnome-red-hat",         "fff9c4"), prompt: `cheerful garden gnome with bright red hat and rosy cheeks, warm sunny yellow background, whimsical fantasy ${P}` },
  { id: "fantasy-witch-friendly", label: "Willa",    category: "fantasy", emoji: "🧙‍♀️", url: adv("FriendlyWitch-purple-hat",     "ede7f6"), prompt: `friendly young witch with purple pointed hat and warm smile, violet magical background, charming fantasy ${P}` },
  { id: "fantasy-knight-brave",   label: "Sterling", category: "fantasy", emoji: "⚔️",   url: advN("BraveKnight-silver-armor",   "e3f2fd"), prompt: `brave young knight in shining silver armor with determined eyes, blue background, heroic fantasy ${P}` },
  { id: "fantasy-unicorn-magic",  label: "Celeste",  category: "fantasy", emoji: "🦄",    url: adv("MagicUnicorn-rainbow-mane",    "fce4ec"), prompt: `magical unicorn girl with rainbow flowing mane and sparkling golden horn, pink magical background, enchanted fantasy ${P}` },

  // ── Magical / Celestial — emoji style, no portrait seeding ───────────────────
  { id: "magic-star-glow",        label: "Starlet", category: "magical", emoji: "⭐", url: emoji("GlowingStar-happy-face",   "fff9c4") },
  { id: "magic-moon-sleepy",      label: "Nox",     category: "magical", emoji: "🌙", url: emoji("SleepyMoon-silver-glow",  "1a237e") },
  { id: "magic-cloud-fluffy",     label: "Nimbus",  category: "magical", emoji: "☁️", url: emoji("FluffyCloud-rosy-breeze", "e3f2fd") },
  { id: "magic-firefly-golden",   label: "Glimmer", category: "magical", emoji: "✨", url: emoji("GoldenFirefly-glow",      "fff9c4") },
  { id: "magic-comet-zoom",       label: "Comet",   category: "magical", emoji: "☄️", url: emoji("ZoomingComet-sparkle",   "1a237e") },
  { id: "magic-rainbow-bright",   label: "Arc",     category: "magical", emoji: "🌈", url: emoji("HappyRainbow-bright-arc", "e8f5e9") },
  { id: "magic-snowflake-crystal",label: "Flake",   category: "magical", emoji: "❄️", url: emoji("CrystalSnowflake-icy",   "e3f2fd") },
  { id: "magic-robot-friendly",   label: "Beep",    category: "magical", emoji: "🤖", url: lorelei("FriendlyRobot-heart",   "e8eaf6") },
];

export const SYSTEM_AVATAR_MAP: Record<string, SystemAvatar> = Object.fromEntries(
  SYSTEM_AVATARS.map((a) => [a.id, a]),
);

export const SYSTEM_AVATAR_CATEGORIES = [
  "child", "adult", "animal", "fantasy", "magical",
] as const;

export type SystemAvatarCategory = (typeof SYSTEM_AVATAR_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<SystemAvatarCategory, string> = {
  child:   "Kids",
  adult:   "Adults",
  animal:  "Animals",
  fantasy: "Fantasy",
  magical: "Magical",
};
