export interface SystemAvatar {
  id: string;
  label: string;
  category: "child" | "adult" | "animal" | "fantasy" | "magical";
  emoji: string;
  prompt: string;
}

const BASE =
  "portrait illustration, soft watercolor style, children's book art, white background, square composition, friendly warm expression";

export const SYSTEM_AVATARS: SystemAvatar[] = [
  // ── Children ─────────────────────────────────────────────────────────────────
  {
    id: "child-girl-stars",
    label: "Luna",
    category: "child",
    emoji: "⭐",
    prompt: `cute 7-year-old girl with starry eyes and glowing silver moon crown, soft pastel colors, ${BASE}`,
  },
  {
    id: "child-boy-adventure",
    label: "Finn",
    category: "child",
    emoji: "🧭",
    prompt: `adventurous 8-year-old boy wearing a tan explorer hat and small backpack, earthy warm tones, ${BASE}`,
  },
  {
    id: "child-girl-artist",
    label: "Mia",
    category: "child",
    emoji: "🎨",
    prompt: `creative 9-year-old girl with paint smudge on her nose holding a colorful paintbrush, vibrant splashes, ${BASE}`,
  },
  {
    id: "child-boy-reader",
    label: "Leo",
    category: "child",
    emoji: "📚",
    prompt: `bookish 6-year-old boy with round glasses holding an open book, cozy warm golden tones, ${BASE}`,
  },
  {
    id: "child-girl-dancer",
    label: "Bella",
    category: "child",
    emoji: "🩰",
    prompt: `graceful 7-year-old girl in a pink tutu with ribbons in her hair, soft pastel pink tones, ${BASE}`,
  },
  {
    id: "child-boy-science",
    label: "Max",
    category: "child",
    emoji: "🔬",
    prompt: `curious 8-year-old boy wearing oversized safety goggles and a mini lab coat, bright cheerful colors, ${BASE}`,
  },
  {
    id: "child-girl-nature",
    label: "Lily",
    category: "child",
    emoji: "🌸",
    prompt: `gentle 6-year-old girl with a crown of wildflowers and a butterfly on her finger, floral pastel colors, ${BASE}`,
  },
  {
    id: "child-boy-pilot",
    label: "Jay",
    category: "child",
    emoji: "✈️",
    prompt: `brave 9-year-old boy in vintage leather pilot goggles and a white scarf, sky blue warm tones, ${BASE}`,
  },
  {
    id: "child-girl-chef",
    label: "Rosa",
    category: "child",
    emoji: "👩‍🍳",
    prompt: `sweet 7-year-old girl in a tiny chef hat and flour-dusted apron with a rolling pin, warm kitchen tones, ${BASE}`,
  },
  {
    id: "child-boy-music",
    label: "Sam",
    category: "child",
    emoji: "🎸",
    prompt: `cool 8-year-old boy strumming a small acoustic guitar with a big happy grin, warm amber tones, ${BASE}`,
  },
  {
    id: "child-girl-magic",
    label: "Zoe",
    category: "child",
    emoji: "✨",
    prompt: `magical 6-year-old girl holding a glowing wand surrounded by golden sparkles, purple and gold tones, ${BASE}`,
  },
  {
    id: "child-toddler-bear",
    label: "Teddy",
    category: "child",
    emoji: "🧸",
    prompt: `adorable toddler in brown bear pajamas hugging a teddy bear, chubby rosy cheeks, cozy warm tones, ${BASE}`,
  },

  // ── Adults ────────────────────────────────────────────────────────────────────
  {
    id: "adult-mom-warm",
    label: "Mom",
    category: "adult",
    emoji: "💝",
    prompt: `warm smiling mother with brown curly hair and gentle caring eyes, golden warm tones, ${BASE}`,
  },
  {
    id: "adult-dad-beard",
    label: "Dad",
    category: "adult",
    emoji: "🌟",
    prompt: `friendly father with a neat beard and kind eyes wearing a cozy knit sweater, earthy tones, ${BASE}`,
  },
  {
    id: "adult-grandma-kind",
    label: "Grandma",
    category: "adult",
    emoji: "🌺",
    prompt: `sweet elderly grandmother with white hair in a bun and round reading glasses, rosy warm tones, ${BASE}`,
  },
  {
    id: "adult-grandpa-wise",
    label: "Grandpa",
    category: "adult",
    emoji: "🎩",
    prompt: `wise grandfather with silver hair and a warm smile wearing a cozy cardigan, soft blue and silver tones, ${BASE}`,
  },
  {
    id: "adult-teacher-bright",
    label: "Teacher",
    category: "adult",
    emoji: "🍎",
    prompt: `cheerful teacher with colorful glasses and a bright blazer holding an apple, vivid warm colors, ${BASE}`,
  },
  {
    id: "adult-chef-jolly",
    label: "Chef",
    category: "adult",
    emoji: "🍳",
    prompt: `jolly chef with a tall white toque, big rosy cheeks and a warm welcoming smile, warm kitchen tones, ${BASE}`,
  },
  {
    id: "adult-scientist-curious",
    label: "Dr. Ray",
    category: "adult",
    emoji: "🔭",
    prompt: `curious female scientist with wild curly hair, a lab coat and round goggles with a telescope, teal and white tones, ${BASE}`,
  },
  {
    id: "adult-musician-cool",
    label: "Jazz",
    category: "adult",
    emoji: "🎵",
    prompt: `cool musician with headphones around neck and a warm confident smile, deep blue and gold tones, ${BASE}`,
  },

  // ── Animals ───────────────────────────────────────────────────────────────────
  {
    id: "animal-fox-clever",
    label: "Foxy",
    category: "animal",
    emoji: "🦊",
    prompt: `clever orange fox with bright amber eyes and a fluffy tail, big expressive eyes, autumn warm tones, ${BASE}`,
  },
  {
    id: "animal-owl-wise",
    label: "Ollie",
    category: "animal",
    emoji: "🦉",
    prompt: `wise owl wearing a tiny graduation cap with round expressive eyes, amber and brown tones, ${BASE}`,
  },
  {
    id: "animal-rabbit-fluffy",
    label: "Bun",
    category: "animal",
    emoji: "🐰",
    prompt: `fluffy white rabbit with long floppy ears and a twitching pink nose, soft white and pink tones, ${BASE}`,
  },
  {
    id: "animal-bear-honey",
    label: "Baloo",
    category: "animal",
    emoji: "🐻",
    prompt: `friendly brown bear holding a small honey pot with a big warm smile, golden brown tones, ${BASE}`,
  },
  {
    id: "animal-cat-magic",
    label: "Mystic",
    category: "animal",
    emoji: "🐱",
    prompt: `elegant silver cat with glowing purple eyes and graceful posture, silver and purple tones, ${BASE}`,
  },
  {
    id: "animal-dog-loyal",
    label: "Buddy",
    category: "animal",
    emoji: "🐶",
    prompt: `loyal golden retriever with floppy ears and a happy tongue-out grin, golden warm tones, ${BASE}`,
  },
  {
    id: "animal-dragon-tiny",
    label: "Sparky",
    category: "animal",
    emoji: "🐉",
    prompt: `tiny friendly green dragon with a round belly and a little spark of fire from its mouth, emerald and orange tones, ${BASE}`,
  },
  {
    id: "animal-penguin-dapper",
    label: "Pip",
    category: "animal",
    emoji: "🐧",
    prompt: `dapper penguin wearing a small bow tie and monocle with a proud expression, black white and gold tones, ${BASE}`,
  },
  {
    id: "animal-panda-chill",
    label: "Bamboo",
    category: "animal",
    emoji: "🐼",
    prompt: `chubby panda holding a bamboo shoot with happy squinting eyes, black and white with green accents, ${BASE}`,
  },
  {
    id: "animal-deer-gentle",
    label: "Dew",
    category: "animal",
    emoji: "🦌",
    prompt: `gentle baby deer with big warm brown eyes and tiny velvet antlers, soft earth tones, ${BASE}`,
  },
  {
    id: "animal-parrot-colorful",
    label: "Rio",
    category: "animal",
    emoji: "🦜",
    prompt: `vibrant tropical parrot with rainbow feathers and mischievous bright eyes, vivid tropical colors, ${BASE}`,
  },
  {
    id: "animal-hedgehog-cute",
    label: "Quill",
    category: "animal",
    emoji: "🦔",
    prompt: `adorable hedgehog wearing a tiny backpack with big bright curious eyes, brown and cream tones, ${BASE}`,
  },

  // ── Fantasy ───────────────────────────────────────────────────────────────────
  {
    id: "fantasy-fairy-wings",
    label: "Fae",
    category: "fantasy",
    emoji: "🧚",
    prompt: `tiny fairy with shimmering iridescent dragonfly wings and a flower petal dress, pastel rainbow glow, dreamy ethereal style, ${BASE}`,
  },
  {
    id: "fantasy-wizard-stars",
    label: "Merlin",
    category: "fantasy",
    emoji: "🧙",
    prompt: `old wizard with a long white beard wearing dark blue starry robes and a pointed hat, midnight blue and gold tones, ${BASE}`,
  },
  {
    id: "fantasy-elf-forest",
    label: "Elara",
    category: "fantasy",
    emoji: "🧝",
    prompt: `graceful forest elf with pointed ears wearing woven leaf clothing and a flower crown, emerald green earthy tones, ${BASE}`,
  },
  {
    id: "fantasy-mermaid-waves",
    label: "Marina",
    category: "fantasy",
    emoji: "🧜",
    prompt: `beautiful mermaid with shimmering teal and purple scales and flowing coral hair, ocean blue coral tones, ${BASE}`,
  },
  {
    id: "fantasy-gnome-garden",
    label: "Gnomeo",
    category: "fantasy",
    emoji: "🍄",
    prompt: `cheerful garden gnome with an oversized red pointed hat, rosy cheeks and a joyful expression, red and earth tones, ${BASE}`,
  },
  {
    id: "fantasy-witch-friendly",
    label: "Willa",
    category: "fantasy",
    emoji: "🧙‍♀️",
    prompt: `friendly young witch with a wide purple hat and a tiny black cat sitting on her shoulder, purple and black tones, ${BASE}`,
  },
  {
    id: "fantasy-knight-brave",
    label: "Sterling",
    category: "fantasy",
    emoji: "⚔️",
    prompt: `brave young knight in polished silver armor with a colorful feathered helmet and visor up, silver and royal blue tones, ${BASE}`,
  },
  {
    id: "fantasy-unicorn-magic",
    label: "Celeste",
    category: "fantasy",
    emoji: "🦄",
    prompt: `magical white unicorn with a flowing rainbow mane and a glowing golden horn, white and rainbow pastel tones, ${BASE}`,
  },

  // ── Magical / Celestial ───────────────────────────────────────────────────────
  {
    id: "magic-star-glow",
    label: "Starlet",
    category: "magical",
    emoji: "⭐",
    prompt: `friendly glowing yellow star character with a happy smiling face and tiny waving arms, golden yellow glow, whimsical, ${BASE}`,
  },
  {
    id: "magic-moon-sleepy",
    label: "Nox",
    category: "magical",
    emoji: "🌙",
    prompt: `gentle crescent moon character with sleepy half-closed eyes and a soft silver glow, silver and deep blue tones, dreamy, ${BASE}`,
  },
  {
    id: "magic-cloud-fluffy",
    label: "Nimbus",
    category: "magical",
    emoji: "☁️",
    prompt: `fluffy white cloud character with rosy cheeks blowing a gentle breeze with a tiny rainbow, sky blue and white tones, whimsical, ${BASE}`,
  },
  {
    id: "magic-firefly-golden",
    label: "Glimmer",
    category: "magical",
    emoji: "✨",
    prompt: `tiny glowing firefly with warm golden light and large curious eyes and delicate wings, golden and soft green glow, whimsical, ${BASE}`,
  },
  {
    id: "magic-comet-zoom",
    label: "Comet",
    category: "magical",
    emoji: "☄️",
    prompt: `cheerful comet character with a smiling face and a colorful sparkling trailing tail, orange and purple cosmic tones, whimsical, ${BASE}`,
  },
  {
    id: "magic-rainbow-bright",
    label: "Arc",
    category: "magical",
    emoji: "🌈",
    prompt: `happy rainbow character with a curved smiling arc face and fluffy clouds at each end, vivid rainbow watercolor, whimsical, ${BASE}`,
  },
  {
    id: "magic-snowflake-crystal",
    label: "Flake",
    category: "magical",
    emoji: "❄️",
    prompt: `delicate snowflake character with a smiling face and intricate icy crystal patterns, icy blue and white tones, whimsical, ${BASE}`,
  },
  {
    id: "magic-robot-friendly",
    label: "Beep",
    category: "magical",
    emoji: "🤖",
    prompt: `adorable small round robot with a heart-shaped glowing display on its chest and a friendly antenna, silver and teal tones, whimsical, ${BASE}`,
  },
];

export const SYSTEM_AVATAR_MAP: Record<string, SystemAvatar> = Object.fromEntries(
  SYSTEM_AVATARS.map((a) => [a.id, a]),
);

export const SYSTEM_AVATAR_CATEGORIES = [
  "child",
  "adult",
  "animal",
  "fantasy",
  "magical",
] as const;

export type SystemAvatarCategory = (typeof SYSTEM_AVATAR_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<SystemAvatarCategory, string> = {
  child: "Kids",
  adult: "Adults",
  animal: "Animals",
  fantasy: "Fantasy",
  magical: "Magical",
};
