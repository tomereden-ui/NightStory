// Pollinations.ai prompts for illustrated option cards in the 5-question creation flow.
// Images are generated once browser-side and cached in Supabase (bucket: story-options).
// v4 — Gemini-optimized concise Pixar 3D prompts

export const WORLD_IMAGE_PROMPTS: Record<string, string> = {
  "deep-ocean":
    "A breathtaking glowing underwater kingdom, giant bioluminescent coral towers, colorful tropical fish, a friendly whale, golden light rays from above. Pixar 3D animated movie style, vibrant blues and teals, cinematic lighting.",
  "enchanted-forest":
    "A magical glowing forest at night, giant luminous mushrooms, thousands of golden fireflies, ancient mossy trees with fairy lights. Pixar 3D animated movie style, warm emerald and amber tones, cinematic.",
  "space-station":
    "A sleek glowing space station orbiting Earth, a child astronaut looking out a giant window at a colorful nebula, floating stars and planets. Pixar 3D animated movie style, vivid blues and purples, cinematic.",
  "candy-kingdom":
    "A magical candy kingdom with towering candy-cane castles, chocolate waterfalls, rainbow gummy rivers, cotton candy clouds. Pixar 3D animated movie style, vibrant saturated colors, cinematic and joyful.",
  "cloud-village":
    "A cozy floating village on fluffy clouds at golden sunset, tiny cottages with glowing windows, rainbow bridges, a hot air balloon. Pixar 3D animated movie style, warm amber and sky blue, cinematic.",
  "underground-caves":
    "A spectacular underground crystal cavern, enormous glowing purple and teal crystals reflected in a still underground lake, tiny explorers with lanterns. Pixar 3D animated movie style, magical and awe-inspiring.",
  "snowy-mountains":
    "A majestic snowy mountain peak at night, vivid green and purple northern lights blazing across the sky, a cozy glowing cabin below, friendly polar bears. Pixar 3D animated movie style, cinematic winter magic.",
  "desert-oasis":
    "A magical desert oasis at sunset, glowing turquoise pool, ancient ruins, colorful silk tents, swaying palm trees, two moons in the sky. Pixar 3D animated movie style, warm gold and teal, cinematic.",
  "dragon-kingdom":
    "A magnificent dragon kingdom carved into a volcanic mountain, friendly colorful dragons soaring between crystal towers, glowing dragon eggs, firelit sky. Pixar 3D animated movie style, epic and spectacular.",
  "pirate-ship":
    "A magical pirate ship sailing a glowing sea at sunset, colorful sails, friendly animal pirates on deck, bioluminescent dolphins leaping. Pixar 3D animated movie style, warm cinematic lighting, adventurous.",
  "magic-school":
    "A grand wizard school castle floating on clouds, towers sparking with colorful magic, students on broomsticks, a friendly dragon on the roof. Pixar 3D animated movie style, warm golden light, cinematic.",
  "jungle-temple":
    "An ancient stone temple in a lush glowing jungle, exotic animals peeking from vivid foliage, glowing golden runes, treasure light inside. Pixar 3D animated movie style, vibrant greens and gold, cinematic.",
  "time-machine":
    "A glowing brass time machine cockpit, swirling portals showing dinosaurs, a futuristic city, a medieval castle, electric blue light. Pixar 3D animated movie style, warm brass and cyan, cinematic and thrilling.",
  "volcano-island":
    "A dramatic tropical volcano island, gentle lava flowing into a sparkling sea, friendly glowing fire spirits, a cozy village with tiki torches. Pixar 3D animated movie style, vivid orange and tropical green, cinematic.",
};

export const COMPANION_IMAGE_PROMPTS: Record<string, string> = {
  friend:
    "Two best friend children laughing in mid-adventure, golden magical sparkles bursting around them, glowing forest background. Pixar 3D animated movie style, warm cinematic lighting, radiant and heartwarming.",
  pet:
    "An impossibly adorable magical animal companion with huge luminous eyes and soft glowing fur, tiny sparkles floating around it, warm beam of golden light. Pixar 3D animated movie style, irresistibly cute, cinematic.",
  creature:
    "A majestic friendly dragon with iridescent rainbow scales, wings spread wide against a dramatic sunset sky, a small amazed child riding on its back. Pixar 3D animated movie style, epic and joyful, cinematic lighting.",
  family:
    "A loving family on a glowing hilltop at golden sunset, magical light rays breaking through dramatic clouds, warm amber glow all around. Pixar 3D animated movie style, deeply heartwarming, cinematic.",
};

export const ENGINE_IMAGE_PROMPTS: Record<string, string> = {
  funny:
    "Hilarious chaotic moment with cartoon animal characters mid-laugh, a pie flying through the air, confetti explosion everywhere, exaggerated googly eyes. Pixar 3D animated movie style, vivid bright colors, pure joyful chaos, cinematic.",
  spooky:
    "A cozy friendly spooky graveyard under a full moon, cute glowing ghosts break-dancing, jack-o-lanterns with silly grins, tiny bats in bow ties. Pixar 3D animated movie style, playful purple and warm orange, charming not scary, cinematic.",
  weird:
    "A surreal dreamscape with houses floating upside-down, giant fish swimming through colorful clouds, melting rainbow clocks draped over candy mountains. Pixar 3D animated movie style, dreamlike pastel explosion, delightfully bizarre, cinematic.",
  delicious:
    "A spectacular magical kitchen with giant floating desserts, chocolate fountains shooting upward, caramel rivers winding between enormous cake mountains. Pixar 3D animated movie style, warm golden light, mouth-wateringly epic, cinematic.",
};

export const MOOD_IMAGE_PROMPTS: Record<string, string> = {
  brave:
    "A young hero child in a golden cape standing triumphantly on a dramatic cliff, vast magical kingdom to the horizon, storm clouds breaking with epic golden light rays. Pixar 3D animated movie style, breathtaking and heroic, cinematic.",
  laughing:
    "A child in mid-air mid-laugh with pure uncontrollable joy, confetti and stars exploding all around, friends laughing below, radiant golden light at the perfect euphoric moment. Pixar 3D animated movie style, infectiously joyful, cinematic.",
  surprised:
    "A child's eyes wide with absolute wonder, jaw dropped, a breathtaking glowing magical discovery before them, sparkles and starlight erupting outward in all directions. Pixar 3D animated movie style, electric awe and magic, cinematic.",
  sleepy:
    "A small child peacefully asleep in a cozy glowing bed, moonlight through a star-filled window, dream clouds forming above with tiny wonderful adventures, a stuffed animal on the pillow. Pixar 3D animated movie style, soft blues and warm gold, deeply peaceful.",
};

export type CreateOptionType = "hero" | "world" | "companion" | "engine" | "mood" | "profile";

export const HERO_IMAGE_PROMPTS: Record<string, string> = {
  own:
    "A glowing child standing before a magical mirror, their reflection shining with golden light and stars swirling outward, warm triumphant moment. Pixar 3D animated movie style, heartwarming and breathtaking, cinematic.",
  magical:
    "Enchanted glowing ancient runes and shimmering stardust floating in a deep purple cosmos, golden particles swirling forming a magical name. Pixar 3D animated movie style, mystical and epic, awe-inspiring, cinematic.",
  stranger:
    "A brave young adventurer in a flowing cape standing on a dramatic hilltop, vast fantasy landscape of glowing mountains and valleys, golden sunrise rays. Pixar 3D animated movie style, heroic and cinematic.",
  surprise:
    "A magical treasure chest bursting open with an explosion of golden light, rainbow confetti, stars and glowing jewels erupting outward in every direction. Pixar 3D animated movie style, electric sense of wonder, cinematic.",
  familyFriend:
    "A joyful group hug between a child, a parent, and a friend, warm golden light rays and soft sparkles floating around them, glowing sunset background. Pixar 3D animated movie style, deeply heartwarming, cinematic.",
  animal:
    "A friendly dog, cat, and tiger cub sitting together in a glowing meadow, big adorable eyes, soft magical sparkles floating around them, warm golden light. Pixar 3D animated movie style, irresistibly cute, cinematic.",
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
  return `v5-${type}-${id}.jpg`;
}
