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

export type CreateOptionType = "hero" | "world" | "companion" | "engine" | "mood" | "profile" | "figure" | "cta" | "sbHero" | "sbCompanion" | "sbSetting" | "sbMission";

// Story Builder — the separate 5-step quick-create flow's own preset
// catalog (src/constants/storyBuilderUi.ts). Distinct ids from the main
// wizard's HERO/COMPANION_IMAGE_PROMPTS above (different presets entirely),
// so these get their own "sb"-prefixed types rather than colliding.
export const SB_HERO_IMAGE_PROMPTS: Record<string, string> = {
  "brave-boy":
    "A cheerful young boy with a bright confident smile and wind-swept hair, standing heroically with hands on hips, golden sunlight behind him. Pixar 3D animated movie style, warm and heroic, cinematic.",
  "smart-girl":
    "A bright young girl with glasses and a curious grin, holding a glowing book, sparkling ideas floating around her head. Pixar 3D animated movie style, warm and clever, cinematic.",
  "fox-cub":
    "An adorable curious baby fox cub with big round eyes and fluffy orange fur, peeking out from behind a glowing flower, tail twitching with excitement. Pixar 3D animated movie style, irresistibly cute, cinematic.",
  unicorn:
    "A magical unicorn with a flowing rainbow mane and a glowing spiral horn, rearing up joyfully amid sparkling stardust. Pixar 3D animated movie style, majestic and magical, cinematic.",
};

export const SB_COMPANION_IMAGE_PROMPTS: Record<string, string> = {
  puppy:
    "An impossibly adorable golden puppy mid-bounce with floppy ears and a huge joyful grin, tiny sparkles trailing behind. Pixar 3D animated movie style, irresistibly cute, cinematic.",
  owl:
    "A wise little owl with big round eyes, perched thoughtfully on a glowing branch under starlight. Pixar 3D animated movie style, warm and endearing, cinematic.",
  solo:
    "A confident young hero standing alone on a glowing hilltop at sunrise, cape fluttering, ready for adventure. Pixar 3D animated movie style, independent and inspiring, cinematic.",
};

export const SB_SETTING_IMAGE_PROMPTS: Record<string, string> = {
  forest:
    "A magical glowing forest clearing at twilight, giant luminous mushrooms, fireflies drifting through ancient mossy trees. Pixar 3D animated movie style, warm emerald and gold, cinematic.",
  "cloud-castle":
    "A dazzling castle floating on fluffy sunset clouds, glowing towers and rainbow flags, a bridge of light connecting to the sky. Pixar 3D animated movie style, warm amber and sky blue, cinematic.",
  "candy-planet":
    "A whimsical candy planet in outer space, swirling rainbow rings of gummy sweets, chocolate craters and cotton-candy clouds against a starry sky. Pixar 3D animated movie style, vibrant and joyful, cinematic.",
};

export const SB_MISSION_IMAGE_PROMPTS: Record<string, string> = {
  "lost-toy":
    "A worn but beloved teddy bear glowing softly in tall grass at dusk, waiting to be found, fireflies drifting nearby. Pixar 3D animated movie style, warm and heartfelt, cinematic.",
  "help-friend":
    "Two young friends embracing warmly, one comforting the other, soft golden light and gentle sparkles surrounding them. Pixar 3D animated movie style, deeply heartwarming, cinematic.",
  "overcome-fear":
    "A small child bravely stepping toward a gently glowing shadow that turns out to be friendly, warm courage-light pushing back the dark. Pixar 3D animated movie style, empowering and warm, cinematic.",
  surprise:
    "A beautifully wrapped glowing gift box bursting open with confetti and warm golden light, sparkles spilling outward. Pixar 3D animated movie style, joyful and warm, cinematic.",
};

// Onboarding's "which storybook figures does your child love?" picker
export const FIGURE_IMAGE_PROMPTS: Record<string, string> = {
  prince:
    "A charming young prince in a royal blue and gold tunic, warm confident smile, standing in a glowing castle courtyard. Pixar 3D animated movie style, portrait framing, vibrant colors, cinematic lighting.",
  princess:
    "A joyful young princess in a flowing lavender gown and sparkling tiara, twirling with golden sparkles trailing her. Pixar 3D animated movie style, portrait framing, vibrant colors, cinematic lighting.",
  dragon:
    "A friendly baby dragon with glittering emerald scales, big round eyes, small puffs of colorful smoke, perched on a rock. Pixar 3D animated movie style, portrait framing, vibrant colors, cinematic lighting.",
  unicorn:
    "A magical unicorn with a flowing rainbow mane and a glowing spiral horn, standing in a field of glittering stars. Pixar 3D animated movie style, portrait framing, vibrant colors, cinematic lighting.",
  ninja:
    "A nimble kid ninja in a sleek indigo outfit with a flowing scarf, mid-leap, tiny stars trailing behind. Pixar 3D animated movie style, portrait framing, vibrant colors, cinematic lighting.",
  robot:
    "A friendly round robot companion with glowing blue eyes and cheerful antenna lights, waving one metal hand. Pixar 3D animated movie style, portrait framing, vibrant colors, cinematic lighting.",
  knight:
    "A brave young knight in shining silver armor with a colorful crest, holding a small sword high, cape fluttering. Pixar 3D animated movie style, portrait framing, vibrant colors, cinematic lighting.",
  mermaid:
    "A cheerful mermaid with a shimmering teal tail and flowing hair, sitting on a sunlit rock with sparkling water. Pixar 3D animated movie style, portrait framing, vibrant colors, cinematic lighting.",
  wizard:
    "A kindly young wizard in deep purple robes and a starry pointed hat, holding a glowing wand with swirling sparkles. Pixar 3D animated movie style, portrait framing, vibrant colors, cinematic lighting.",
  superhero:
    "A confident kid superhero in a bold red and gold cape, fists on hips, triumphant pose, city lights glowing behind. Pixar 3D animated movie style, portrait framing, vibrant colors, cinematic lighting.",
};

// Background art for the "Create your first story" CTA card on the home
// screen — a single cohesive ensemble scene, not a picker grid.
export const CTA_IMAGE_PROMPTS: Record<string, string> = {
  "first-story":
    "A joyful gathering of magical storybook friends under a starry night sky — a friendly unicorn with a glowing rainbow mane, a small round-eyed dragon, a nimble kid ninja, a cheerful robot, and a golden puppy — all playing together in a swirl of golden sparkles and warm light. Pixar 3D animated movie style, wide cinematic composition, rich cosmic purples and warm gold, magical and inviting, no text.",
  // Short wide banner for the returning-user "Create a Story" strip — a
  // distinct scene from first-story so it doesn't feel repeated once a
  // family has already been through the empty state once.
  "returning-strip":
    "A cozy magical reading nook at night — a tiny fairy, a baby dragon curled up, a wizard cat with a pointed hat, and a friendly little ghost all gathered around a glowing open storybook, warm golden sparkles drifting upward. Pixar 3D animated movie style, wide short banner composition, rich cosmic purples and warm gold, cozy and inviting, no text.",
};

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
    "A single confident, happy lion standing tall and proud alone on a dramatic mountain peak, mane flowing majestically in the wind, chest out, head held high, joyful triumphant expression, warm golden sunset light, epic sky behind. Pixar 3D animated movie style, bold and heroic, radiating courage and strength, cinematic.",
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
  for (const [id, prompt] of Object.entries(FIGURE_IMAGE_PROMPTS))
    specs.push({ type: "figure", id, prompt });
  for (const [id, prompt] of Object.entries(CTA_IMAGE_PROMPTS))
    specs.push({ type: "cta", id, prompt });
  for (const [id, prompt] of Object.entries(SB_HERO_IMAGE_PROMPTS))
    specs.push({ type: "sbHero", id, prompt });
  for (const [id, prompt] of Object.entries(SB_COMPANION_IMAGE_PROMPTS))
    specs.push({ type: "sbCompanion", id, prompt });
  for (const [id, prompt] of Object.entries(SB_SETTING_IMAGE_PROMPTS))
    specs.push({ type: "sbSetting", id, prompt });
  for (const [id, prompt] of Object.entries(SB_MISSION_IMAGE_PROMPTS))
    specs.push({ type: "sbMission", id, prompt });
  return specs;
}

export function optionStorageKey(type: CreateOptionType, id: string): string {
  return `v5-${type}-${id}.jpg`;
}
