// Pollinations.ai prompts for illustrated option cards in the 5-question creation flow.
// Images are generated once browser-side and cached in Supabase (bucket: story-options).
// v2 — dramatic cinematic concept-art style prompts

export const WORLD_IMAGE_PROMPTS: Record<string, string> = {
  "deep-ocean":
    "vast glowing underwater kingdom, towering bioluminescent coral spires, massive manta rays gliding through shafts of light, epic cinematic scale, children's fantasy concept art, breathtaking deep teal and electric blue, ultra detailed",
  "enchanted-forest":
    "ancient enchanted forest at night, enormous glowing mushrooms taller than houses, thousands of fireflies forming constellations, moonbeams through twisted silver trees, children's epic fantasy concept art, emerald and gold cinematic lighting",
  "space-station":
    "dramatic futuristic space station soaring above a glowing planet, stars and nebula explosion through massive windows, astronaut silhouette against cosmos, children's fantasy concept art, electric blue and violet, cinematic and breathtaking",
  "candy-kingdom":
    "epic candy kingdom at golden hour, towering candy-cane skyscrapers, chocolate waterfalls cascading into rainbow rivers, cotton candy storm clouds, children's fantasy concept art, saturated jewel tones, cinematic wide shot",
  "cloud-village":
    "magical floating village suspended above the clouds at sunset, cozy cottages connected by rainbow bridges, giant airship docking nearby, god rays of golden light, children's fantasy concept art, warm epic cinematics",
  "underground-caves":
    "spectacular underground crystal cavern, cathedral-sized amethyst formations glowing purple and teal, underground river reflecting a thousand prismatic lights, children's epic fantasy concept art, awe-inspiring and vast",
  "snowy-mountains":
    "dramatic arctic mountain peak at night, northern lights aurora blazing in vivid greens and purples, lone cozy glowing cabin far below, frosted pine silhouettes, children's epic fantasy concept art, breathtaking cinematic scale",
  "desert-oasis":
    "magical desert oasis at dusk, ancient ruins rising from golden sand, crystal blue pool glowing under two moons, billowing silk tents, children's fantasy concept art, warm gold and turquoise cinematic lighting",
};

export const COMPANION_IMAGE_PROMPTS: Record<string, string> = {
  friend:
    "two children best friends laughing together in a burst of golden magical light, sparkles and stars swirling around them, epic warm cinematic glow, children's fantasy concept art, joyful and radiant",
  pet:
    "impossibly adorable magical creature with giant luminous eyes and soft glowing fur, sitting in a beam of golden light, surrounded by tiny dancing sparkles, children's fantasy concept art, heartwarming and breathtaking",
  creature:
    "majestic magical dragon-phoenix hybrid, iridescent scales and feathers catching rainbow light, wings spread dramatically, glowing softly in a misty forest, children's epic fantasy concept art, vivid and awe-inspiring",
  family:
    "warm silhouettes of a loving family embracing on a hilltop, magical golden sunset with rays of light breaking through dramatic clouds, children's epic fantasy concept art, deeply heartwarming",
};

export const ENGINE_IMAGE_PROMPTS: Record<string, string> = {
  funny:
    "hilarious chaotic scene of cartoon characters mid-laugh, confetti explosion, pies flying through the air, exaggerated comic expressions, children's fantasy concept art, bright vivid colors, pure joyful mayhem",
  spooky:
    "friendly spooky moonlit graveyard, cute glowing ghosts doing a dance, jack-o-lanterns with goofy smiles, bats wearing tiny hats, children's fantasy concept art, purple and warm orange, playful and charming not scary",
  weird:
    "surreal impossible dreamscape, houses floating upside down, fish flying through clouds, giant clocks melting over candy mountains, children's epic fantasy concept art, dreamlike pastel explosion, wonderfully bizarre",
  delicious:
    "magical floating banquet of giant desserts, chocolate fountains erupting into the air, caramel rivers flowing between cake mountains, everything glowing with warm golden light, children's fantasy concept art, mouth-wateringly rich",
};

export const MOOD_IMAGE_PROMPTS: Record<string, string> = {
  brave:
    "young hero standing on a dramatic cliff edge, golden cape billowing in epic wind, vast fantasy landscape behind them, dramatic god rays from storm clouds breaking, children's epic fantasy concept art, heroic and breathtaking",
  laughing:
    "child mid-laugh with pure uncontrollable joy, confetti and stars exploding in every direction, radiant golden light, infectious happiness frozen in a perfect moment, children's fantasy concept art, vivid and euphoric",
  surprised:
    "child's eyes wide with magical wonder at a breathtaking discovery, sparkles and starlight erupting around them, a glowing portal revealing an impossible world, children's epic fantasy concept art, awe and magic",
  sleepy:
    "dreamy child tucked in a magical glowing bed, moonlight streaming through a starry window, dream clouds forming above filled with tiny adventures, soft twinkling stars, children's fantasy concept art, soft blues and warm gold, deeply peaceful",
};

export type CreateOptionType = "hero" | "world" | "companion" | "engine" | "mood" | "profile";

export const HERO_IMAGE_PROMPTS: Record<string, string> = {
  own:
    "glowing child silhouette bursting with golden light in front of a magical mirror showing their radiant reflection, stars and sparkles cascading outward, children's epic fantasy concept art, triumphant and breathtaking",
  magical:
    "enchanted ancient runes and shimmering stardust forming a glowing name in a dark mystical cosmos, golden light particles swirling, deep purple nebula backdrop, children's fantasy concept art, epic and mystical",
  stranger:
    "lone brave young adventurer on a dramatic hilltop, epic fantasy landscape stretching to the horizon behind them, dramatic clouds and golden sunrays, children's epic fantasy concept art, heroic cinematic scale",
  surprise:
    "magical glowing chest bursting open with an explosion of golden light and rainbow confetti, stars and jewels erupting outward in every direction, children's epic fantasy concept art, sense of electric wonder",
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
  return `v2-${type}-${id}.jpg`;
}
