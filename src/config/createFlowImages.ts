// Pollinations.ai prompts for illustrated option cards in the 5-question creation flow.
// Images are generated once browser-side and cached in Supabase (bucket: story-options).

export const WORLD_IMAGE_PROMPTS: Record<string, string> = {
  "deep-ocean":
    "magical deep underwater world, bioluminescent jellyfish and fish, glowing coral reefs, god rays of light from above, children's book digital illustration, dreamy teal and deep blue, highly detailed, painterly",
  "enchanted-forest":
    "magical enchanted forest at night, giant glowing mushrooms, fireflies, ancient mossy trees, fairy lights, children's book illustration, lush emerald and gold tones, painterly",
  "space-station":
    "futuristic space station orbiting Earth, stars and nebula through windows, glowing control panels, astronaut helmet reflection, children's book digital illustration, vivid blues and purples",
  "candy-kingdom":
    "magical candy kingdom, rainbow candy cane towers, chocolate river, gumdrop hills, cotton candy clouds, children's book illustration, bright saturated pastels, whimsical",
  "cloud-village":
    "whimsical village on top of fluffy clouds, tiny cozy cottages, rainbow bridges, hot air balloons, golden sunrise light, children's book illustration, pastel sky blues and warm golds",
  "underground-caves":
    "magical underground crystal cave, giant glowing amethyst crystals, underground river reflecting light, ancient stone bridges, children's book illustration, purple and teal glow",
  "snowy-mountains":
    "magical snowy mountain landscape, cozy lit cottage, northern lights aurora borealis, frosted pine trees, starry night sky, children's book illustration, cool blues and warm amber",
  "desert-oasis":
    "magical desert oasis at sunset, crystal blue pool, ancient stone ruins, palm trees, colorful tents, golden sand dunes, children's book illustration, warm golds and teals",
};

export const COMPANION_IMAGE_PROMPTS: Record<string, string> = {
  friend:
    "two best friends children laughing together, magical sparkles around them, warm glowing light, cozy and joyful scene, children's book digital illustration, warm pastels",
  pet:
    "adorable magical pet with glowing eyes, fluffy and friendly, magical sparkles around it, children's book illustration, soft warm light, cute and heartwarming",
  creature:
    "magical fantasy creature, cute dragon-unicorn hybrid with colorful wings, glowing softly, whimsical forest background, children's book illustration, vibrant colors",
  family:
    "warm loving family hugging together, golden sunset light through window, cozy home setting, children's book illustration, warm golden and amber tones, heartwarming",
};

export const ENGINE_IMAGE_PROMPTS: Record<string, string> = {
  funny:
    "hilarious cartoon scene, characters with exaggerated funny expressions, confetti and stars, children's book illustration, bright cheerful colors, pure joyful chaos",
  spooky:
    "friendly cozy spooky scene, cute smiling ghost floating in moonlit graveyard, glowing jack-o-lanterns, children's book illustration, purple and orange, playful not scary",
  weird:
    "surreal magical impossible scene, house floating upside down, flying fish in the sky, melting clocks, children's book illustration, dreamy pastel colors, whimsical",
  delicious:
    "magical feast of floating desserts and treats, swirling cakes and candy, caramel rivers, golden light, children's book illustration, warm rich colors, mouthwatering",
};

export const MOOD_IMAGE_PROMPTS: Record<string, string> = {
  brave:
    "brave young child hero standing on a hilltop, golden cape flowing in wind, epic sunset sky behind, children's book illustration, dramatic golden and orange tones",
  laughing:
    "child laughing with pure joy and delight, confetti and stars exploding around them, huge smile, children's book illustration, bright and colorful, infectious happiness",
  surprised:
    "child with wide eyes of wonder at a magical discovery, sparkles and stars appearing, magical glow, children's book illustration, warm tones, sense of awe and magic",
  sleepy:
    "sleepy child tucked in cozy bed, moonlight through window, stars and moon outside, dream clouds forming, teddy bear, children's book illustration, soft blues and purples, peaceful",
};

export type CreateOptionType = "hero" | "world" | "companion" | "engine" | "mood" | "profile";

export const HERO_IMAGE_PROMPTS: Record<string, string> = {
  own:
    "happy child looking at their glowing reflection in a magical mirror, stars and sparkles, children's book digital illustration, warm golden light, joyful and proud",
  magical:
    "enchanted glowing name written in floating stardust and light, magical runes and sparkles swirling, children's book illustration, deep purple and gold tones, mystical",
  stranger:
    "brave young adventurer with a backpack and map standing on a hilltop, epic landscape behind, children's book illustration, warm amber sunset, heroic and curious",
  surprise:
    "magical surprise box bursting open with stars, confetti, and glowing light, children's book illustration, bright vivid colors, sense of wonder and delight",
};

export interface CreateOptionSpec {
  type: CreateOptionType;
  id: string;
  prompt: string;
}

export const PROFILE_IMAGE_PROMPTS: Record<string, string> = {
  // Display mode cards
  "mode-auto":
    "magical shape-shifting device morphing between phone, tablet and screen, glowing transformation aura, children's book digital illustration, cosmic blues and purples, seamless and fluid",
  "mode-mobile":
    "sleek glowing smartphone floating in a starry night sky, soft light emanating from the screen, children's book illustration, deep blue and cyan tones, elegant and modern",
  "mode-tablet":
    "elegant tablet device floating with a glowing warm screen, magical sparkles around it, children's book illustration, soft golden and teal light, futuristic yet cozy",
  "mode-desktop":
    "wide glowing monitor screen showing a magical starfield, dramatic light beams, children's book illustration, rich purple and blue tones, impressive and immersive",
  // Settings cards
  "setting-notifications":
    "magical golden bell floating with shimmering stars and sparkles around it, soft warm light rays, children's book illustration, warm amber and gold tones, delightful",
  "setting-nightmode":
    "serene crescent moon in a starry night sky, glowing softly, cozy clouds and distant stars, children's book illustration, deep indigo and soft silver tones, peaceful",
  "setting-volume":
    "magical musical notes and sound waves floating through glowing air, colorful swirling ribbons of sound, children's book illustration, warm vibrant colors, joyful",
};

export function getAllCreateOptionSpecs(): CreateOptionSpec[] {
  const specs: CreateOptionSpec[] = [];
  for (const [id, prompt] of Object.entries(HERO_IMAGE_PROMPTS))
    specs.push({ type: "hero", id, prompt });
  for (const [id, prompt] of Object.entries(WORLD_IMAGE_PROMPTS))
    specs.push({ type: "world", id, prompt });
  for (const [id, prompt] of Object.entries(COMPANION_IMAGE_PROMPTS))
    specs.push({ type: "companion", id, prompt });
  for (const [id, prompt] of Object.entries(ENGINE_IMAGE_PROMPTS))
    specs.push({ type: "engine", id, prompt });
  for (const [id, prompt] of Object.entries(MOOD_IMAGE_PROMPTS))
    specs.push({ type: "mood", id, prompt });
  for (const [id, prompt] of Object.entries(PROFILE_IMAGE_PROMPTS))
    specs.push({ type: "profile", id, prompt });
  return specs;
}

export function optionStorageKey(type: CreateOptionType, id: string): string {
  return `${type}-${id}.jpg`;
}
