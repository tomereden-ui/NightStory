// Pollinations.ai prompts for illustrated option cards in the 5-question creation flow.
// Images are generated once browser-side and cached in Supabase (bucket: story-options).
// v3 — Pixar-style cinematic quality prompts

export const WORLD_IMAGE_PROMPTS: Record<string, string> = {
  "deep-ocean":
    "Pixar animated movie scene, vast glowing underwater kingdom, friendly giant whale swimming past bioluminescent coral towers, shafts of golden light piercing deep blue water, tiny colorful fish in formation, warm cinematic lighting, ultra detailed, 3D animation style, breathtaking and magical",
  "enchanted-forest":
    "Pixar animated movie scene, magical ancient forest at twilight, giant glowing mushrooms taller than trees, thousands of fireflies forming a galaxy overhead, a tiny hidden fairy village nestled in mossy roots, warm golden and emerald light, 3D animation cinematic style, ultra detailed and enchanting",
  "space-station":
    "Pixar animated movie scene, gleaming futuristic space station orbiting a swirling nebula, a small brave astronaut child pressed against a massive window watching a comet streak past, Earth glowing below, dramatic starfield, 3D animation cinematic style, vivid electric blue and purple, breathtaking",
  "candy-kingdom":
    "Pixar animated movie scene, epic candy kingdom stretching to the horizon, towering rainbow candy-cane spires, chocolate waterfalls tumbling into gummy rivers, cotton candy clouds raining sprinkles, cheerful candy citizens waving, warm saturated colors, 3D animation cinematic style, joyful and spectacular",
  "cloud-village":
    "Pixar animated movie scene, whimsical floating village high above the clouds at golden sunset, cozy glowing cottages on fluffy cloud platforms connected by rainbow rope bridges, a grand airship arriving with passengers, warm amber and soft blue light, 3D animation cinematic style, magical and inviting",
  "underground-caves":
    "Pixar animated movie scene, breathtaking underground crystal cavern the size of a cathedral, enormous glowing amethyst and emerald formations reflecting in a still underground lake, tiny explorers with lanterns dwarfed by the scale, teal and violet light, 3D animation cinematic style, awe-inspiring",
  "snowy-mountains":
    "Pixar animated movie scene, majestic snow-capped mountain at night, northern lights blazing in vivid greens purples and pinks across the sky, a cozy glowing cabin with warm light pouring from its windows, a family of friendly polar bears passing by, 3D animation cinematic style, magical winter wonder",
  "desert-oasis":
    "Pixar animated movie scene, magical desert oasis at dusk beneath two glowing moons, crystal turquoise pool surrounded by ancient stone ruins and swaying palms, colorful silk tents glowing from within, a friendly camel wearing a vest, warm gold and teal light, 3D animation cinematic style, adventurous",
  "dragon-kingdom":
    "Pixar animated movie scene, magnificent dragon kingdom built into the side of a volcanic mountain, friendly colorful dragons of all sizes soaring between glowing crystal towers, a dragon hatchery with glowing rainbow eggs, epic warm firelight and violet sky, 3D animation cinematic style, spectacular",
  "pirate-ship":
    "Pixar animated movie scene, magnificent magical pirate ship sailing through a glowing sea at sunset, colorful sails billowing, a friendly crew of animal pirates on deck, bioluminescent dolphins leaping alongside, treasure islands visible on the glowing horizon, 3D animation cinematic style, adventurous",
  "magic-school":
    "Pixar animated movie scene, grand magical school castle floating on a cloud island, towers shooting sparks of colored light into the sky, young wizard students flying on broomsticks, a dragon perched on the tallest spire, warm golden light from a thousand windows, 3D animation cinematic style, wondrous",
  "jungle-temple":
    "Pixar animated movie scene, ancient stone temple rising from a lush jungle, friendly exotic animals peering from vibrant foliage, glowing runes on the temple walls, golden treasure light spilling from a hidden door, colorful parrots and butterflies everywhere, 3D animation cinematic style, magical discovery",
  "time-machine":
    "Pixar animated movie scene, spectacular glowing time machine cockpit surrounded by swirling vortexes of different eras, dinosaurs visible through one portal, a futuristic city through another, a medieval castle through a third, warm brass and electric blue light, 3D animation cinematic style, thrilling",
  "volcano-island":
    "Pixar animated movie scene, dramatic tropical volcano island surrounded by sparkling sea, lava gently flowing to the water creating rainbow steam clouds, friendly fire spirits dancing near the caldera, a hidden tropical village with tiki torches, vivid orange gold and tropical green, 3D animation cinematic style",
};

export const COMPANION_IMAGE_PROMPTS: Record<string, string> = {
  friend:
    "Pixar animated movie scene, two best friend children laughing together mid-adventure, golden magical sparkles bursting around them, warm cinematic glow, genuine joy, 3D animation cinematic style, radiant and heartwarming",
  pet:
    "Pixar animated movie scene, impossibly adorable magical animal companion with huge luminous eyes and soft glowing fur, sitting in a warm beam of light, tiny sparkles floating around it, 3D animation cinematic style, irresistibly cute",
  creature:
    "Pixar animated movie scene, majestic friendly dragon with iridescent glowing scales, wings spread wide against a dramatic sunset sky, a small child riding on its back looking amazed, 3D animation cinematic style, epic and joyful",
  family:
    "Pixar animated movie scene, a loving family silhouetted on a hilltop embracing at golden sunset, magical light rays breaking through dramatic clouds, warm amber glow, 3D animation cinematic style, deeply heartwarming",
};

export const ENGINE_IMAGE_PROMPTS: Record<string, string> = {
  funny:
    "Pixar animated movie scene, hilarious chaotic moment with cartoon animal characters mid-laugh, a pie flying through the air, confetti explosion, exaggerated comic expressions and googly eyes, vivid bright colors, 3D animation cinematic style, pure joyful chaos",
  spooky:
    "Pixar animated movie scene, friendly cozy spooky graveyard under a full moon, cute glowing ghosts break-dancing, jack-o-lanterns with silly grins, tiny bats in bow ties, playful purple and warm orange light, 3D animation cinematic style, charming not scary",
  weird:
    "Pixar animated movie scene, wonderfully surreal dreamscape, houses floating upside down, giant fish swimming through colorful clouds, melting rainbow clocks draped over candy mountains, dreamlike pastel explosion, 3D animation cinematic style, delightfully bizarre",
  delicious:
    "Pixar animated movie scene, spectacular magical kitchen with giant floating desserts, chocolate fountains shooting into the air, caramel rivers winding between cake mountains, everything glowing with warm golden light, 3D animation cinematic style, mouth-wateringly epic",
};

export const MOOD_IMAGE_PROMPTS: Record<string, string> = {
  brave:
    "Pixar animated movie scene, young hero child in a golden cape standing triumphantly on a dramatic cliff, vast magical kingdom stretching to the horizon behind them, storm clouds breaking with rays of epic golden light, 3D animation cinematic style, breathtaking and heroic",
  laughing:
    "Pixar animated movie scene, child in mid-air mid-laugh with pure uncontrollable joy, confetti and stars exploding around them, friends laughing below, radiant golden light frozen at the perfect euphoric moment, 3D animation cinematic style, infectiously joyful",
  surprised:
    "Pixar animated movie scene, child's eyes wide with absolute wonder, jaw dropped, a breathtaking magical discovery glowing before them, sparkles and starlight erupting outward, 3D animation cinematic style, electric sense of awe and magic",
  sleepy:
    "Pixar animated movie scene, small child peacefully asleep in a cozy glowing bed, moonlight streaming through a star-filled window, dream clouds forming above full of tiny wonderful adventures, a stuffed animal on the pillow, 3D animation cinematic style, soft blues and warm gold, deeply peaceful",
};

export type CreateOptionType = "hero" | "world" | "companion" | "engine" | "mood" | "profile";

export const HERO_IMAGE_PROMPTS: Record<string, string> = {
  own:
    "Pixar animated movie scene, a glowing child standing before a magical mirror, their reflection shining with golden light and stars swirling outward, warm triumphant moment, 3D animation cinematic style, heartwarming and breathtaking",
  magical:
    "Pixar animated movie scene, enchanted glowing ancient runes and shimmering stardust floating in a deep purple cosmos, golden particles swirling forming a magical name, mystical and epic, 3D animation cinematic style, awe-inspiring",
  stranger:
    "Pixar animated movie scene, brave young adventurer in a flowing cape standing on a dramatic hilltop, vast fantasy landscape of mountains and glowing valleys behind them, golden sunrise rays, 3D animation cinematic style, heroic",
  surprise:
    "Pixar animated movie scene, magical treasure chest bursting open with an explosion of golden light, rainbow confetti, stars and glowing jewels erupting outward in every direction, electric sense of wonder, 3D animation cinematic style",
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
  return `v3-${type}-${id}.jpg`;
}
