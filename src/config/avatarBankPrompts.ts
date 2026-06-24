// 50 diverse avatar descriptions — used for embedding (matching) and image generation.
// The description is the match target; AVATAR_STYLE_SUFFIX is appended only for image generation.

export const AVATAR_STYLE_SUFFIX =
  ", 3D animated character portrait, Pixar and Disney style, soft volumetric studio lighting, " +
  "friendly expressive face centered in frame, circular avatar crop, clean gradient background " +
  "with soft blue-purple cosmic glow, vibrant rich colors, highly detailed, no text, no letters, no background figures";

export interface AvatarDef {
  description: string;
  type: "child" | "adult" | "animal";
  gender: "boy" | "girl" | "male" | "female" | "neutral";
  traits: string[];
}

export const AVATAR_BANK: AvatarDef[] = [
  // ── Children – Girls ──────────────────────────────────────────────────────────
  {
    description: "animated storybook girl character, wispy blonde hair, round blue eyes, pink bunny pajamas, sleepy sweet smile",
    type: "child", gender: "girl", traits: ["toddler", "blonde", "sleepy", "cute"],
  },
  {
    description: "young animated girl character, afro puffs with pink ribbons, dark brown eyes, sparkly pink tutu, joyful laughing expression",
    type: "child", gender: "girl", traits: ["young", "joyful", "afro", "playful"],
  },
  {
    description: "young animated girl character, short black bob, almond-shaped dark eyes, floral dress, gentle curious smile",
    type: "child", gender: "girl", traits: ["curious", "gentle", "East Asian", "sweet"],
  },
  {
    description: "young animated girl character, curly red hair, freckled nose, bright green eyes, yellow raincoat, adventurous grin",
    type: "child", gender: "girl", traits: ["adventurous", "red hair", "freckles", "energetic"],
  },
  {
    description: "animated girl character, medium brown skin, braids with colorful beads, teal hoodie, confident warm smile",
    type: "child", gender: "girl", traits: ["confident", "braids", "warm", "brown skin"],
  },
  {
    description: "animated girl character, long wavy dark hair, brown eyes, purple galaxy sweater, dreamy thoughtful gaze",
    type: "child", gender: "girl", traits: ["dreamy", "thoughtful", "dark hair", "imaginative"],
  },
  {
    description: "animated girl character, straight black hair with blunt bangs, wearing red and gold traditional top, graceful serene expression",
    type: "child", gender: "girl", traits: ["graceful", "traditional", "serene", "East Asian"],
  },
  {
    description: "animated girl character, long blonde hair, bright blue eyes, wearing purple cloak and star earrings, wise and curious expression",
    type: "child", gender: "girl", traits: ["wise", "magical", "blonde", "curious"],
  },
  {
    description: "animated girl character, curly mixed-heritage hair, wearing science lab coat over colorful shirt, brilliant excited smile",
    type: "child", gender: "girl", traits: ["brilliant", "scientist", "excited", "mixed heritage"],
  },

  // ── Children – Boys ───────────────────────────────────────────────────────────
  {
    description: "animated storybook boy character, chubby cheeks, black hair, rocket ship pajamas, happy sleepy face",
    type: "child", gender: "boy", traits: ["toddler", "sleepy", "happy", "black hair"],
  },
  {
    description: "young animated boy character, pale skin, red freckles, spiky orange hair, denim overalls, mischievous grin",
    type: "child", gender: "boy", traits: ["mischievous", "freckles", "red hair", "playful"],
  },
  {
    description: "animated cartoon superhero boy character, dark complexion, big warm brown eyes, red superhero cape, brave excited expression",
    type: "child", gender: "boy", traits: ["brave", "superhero", "dark skin", "excited"],
  },
  {
    description: "young animated boy character, floppy brown hair, hazel eyes, yellow backpack, curious adventurous grin",
    type: "child", gender: "boy", traits: ["curious", "adventurous", "brown hair", "energetic"],
  },
  {
    description: "animated boy character, curly blond hair, sky blue eyes, striped sailor shirt, joyful energetic expression",
    type: "child", gender: "boy", traits: ["joyful", "blonde", "energetic", "nautical"],
  },
  {
    description: "animated boy character, round glasses, light brown hair, inventor's goggles on forehead, intelligent focused look",
    type: "child", gender: "boy", traits: ["intelligent", "inventor", "glasses", "focused"],
  },
  {
    description: "animated boy character, straight dark hair, almond eyes, green explorer vest with pockets, determined confident look",
    type: "child", gender: "boy", traits: ["determined", "explorer", "confident", "East Asian"],
  },
  {
    description: "animated boy character, dark curly hair, navy blue hoodie, thoughtful kind expression",
    type: "child", gender: "boy", traits: ["thoughtful", "kind", "dark hair", "tall"],
  },
  {
    description: "animated boy character, athletic build, medium brown skin, wearing track jacket, proud cheerful grin",
    type: "child", gender: "boy", traits: ["athletic", "proud", "cheerful", "sporty"],
  },

  // ── Adults – Female ───────────────────────────────────────────────────────────
  {
    description: "illustrated elderly grandmother character, white curly hair, warm wrinkled smile, floral cardigan, kind twinkling eyes",
    type: "adult", gender: "female", traits: ["elderly", "warm", "grandmother", "kind"],
  },
  {
    description: "illustrated adult ranger woman, long dark brown hair, bright green eyes, forest ranger uniform, adventurous spirit",
    type: "adult", gender: "female", traits: ["adventurous", "young", "ranger", "nature"],
  },
  {
    description: "illustrated adult scientist woman, short natural afro, warm brown complexion, lab coat, brilliant warm expression",
    type: "adult", gender: "female", traits: ["brilliant", "scientist", "natural hair", "warm"],
  },
  {
    description: "illustrated adult adventurer woman, fiery red hair, pale freckled skin, leather jacket, fierce brave look",
    type: "adult", gender: "female", traits: ["fierce", "brave", "red hair", "adventurer"],
  },
  {
    description: "illustrated adult sorceress character, long straight black hair, elegant purple robes, mysterious and graceful expression",
    type: "adult", gender: "female", traits: ["mysterious", "elegant", "magical", "graceful"],
  },
  {
    description: "illustrated adult fairy woman, violet streaks in dark hair, fairy court outfit with wings, playful magical expression",
    type: "adult", gender: "female", traits: ["magical", "fairy", "playful", "whimsical"],
  },
  {
    description: "illustrated adult professor woman, silver-streaked dark hair, warm brown complexion, wire-rim glasses, scholarly and kind",
    type: "adult", gender: "female", traits: ["scholarly", "kind", "professor", "wise"],
  },
  {
    description: "illustrated adult wizard woman, small and nimble, long silver braid, star-covered wizard cape, mischievously wise expression",
    type: "adult", gender: "female", traits: ["wise", "mischievous", "wizard", "silver hair"],
  },
  {
    description: "illustrated adult princess character, olive complexion, dark curly hair, golden crown, regal but warm expression",
    type: "adult", gender: "female", traits: ["regal", "princess", "warm", "dark hair"],
  },

  // ── Adults – Male ─────────────────────────────────────────────────────────────
  {
    description: "illustrated elderly grandfather character, silver hair, bushy white eyebrows, suspenders and bowler hat, storyteller warmth in eyes",
    type: "adult", gender: "male", traits: ["elderly", "grandfather", "wise", "warm"],
  },
  {
    description: "illustrated adult wizard apprentice, curly blond hair, blue eyes, robes with stars, eager and earnest expression",
    type: "adult", gender: "male", traits: ["young", "eager", "wizard", "blonde"],
  },
  {
    description: "illustrated adult knight character, strong build, dark beard and olive complexion, shining armor, noble protective expression",
    type: "adult", gender: "male", traits: ["noble", "knight", "protective", "strong"],
  },
  {
    description: "illustrated adult musician character, dark wavy hair, warm olive complexion, colorful vest, joyful creative energy",
    type: "adult", gender: "male", traits: ["creative", "joyful", "musician", "South Asian"],
  },
  {
    description: "illustrated adult lumberjack character, blonde beard, tall and broad build, flannel shirt, gentle giant with kind eyes",
    type: "adult", gender: "male", traits: ["gentle", "kind", "giant", "blonde beard"],
  },
  {
    description: "illustrated adult sea captain character, round belly, full white beard, captain's coat with gold buttons, hearty laughing expression",
    type: "adult", gender: "male", traits: ["jolly", "captain", "white beard", "hearty"],
  },
  {
    description: "illustrated adult scholar character, almond-shaped eyes, scholar's robes, bamboo staff, wise and centered calm expression",
    type: "adult", gender: "male", traits: ["wise", "calm", "scholar", "East Asian"],
  },
  {
    description: "illustrated adult archer character, deep brown complexion, athletic build, green tunic and quiver, focused and intense expression",
    type: "adult", gender: "male", traits: ["focused", "archer", "athletic", "intense"],
  },
  {
    description: "illustrated adult storyteller character, weathered kind face, grey temples, sea captain's coat, experienced warm expression",
    type: "adult", gender: "male", traits: ["experienced", "captain", "weathered", "kind"],
  },

  // ── Animals ───────────────────────────────────────────────────────────────────
  {
    description: "wise old owl with round golden spectacles, fluffy grey-brown feathers, knowing gentle gaze",
    type: "animal", gender: "neutral", traits: ["owl", "wise", "spectacles", "gentle"],
  },
  {
    description: "young playful fox, bright orange fur, white chest patch, big curious amber eyes, perky triangular ears",
    type: "animal", gender: "neutral", traits: ["fox", "playful", "curious", "orange"],
  },
  {
    description: "gentle white rabbit, long floppy ears, soft pink nose, holding a tiny clover, shy sweet smile",
    type: "animal", gender: "neutral", traits: ["rabbit", "gentle", "white", "shy"],
  },
  {
    description: "friendly young dragon, shimmery purple-blue scales, small folded wings, big innocent round eyes, warm smile",
    type: "animal", gender: "neutral", traits: ["dragon", "friendly", "purple", "innocent"],
  },
  {
    description: "loyal golden retriever dog, floppy ears, warm chocolate eyes, tongue happily out, radiating pure joy",
    type: "animal", gender: "neutral", traits: ["dog", "loyal", "joyful", "golden"],
  },
  {
    description: "mischievous striped tabby cat, bright green eyes, one raised paw, whiskers twitching, clever grin",
    type: "animal", gender: "neutral", traits: ["cat", "mischievous", "tabby", "clever"],
  },
  {
    description: "wise elephant, huge kind dark eyes, gentle wrinkled grey face, long lashes, serene and patient expression",
    type: "animal", gender: "neutral", traits: ["elephant", "wise", "serene", "gentle"],
  },
  {
    description: "brave little mouse, round ears, tiny whiskers, wearing a tiny acorn cap, determined and fearless grin",
    type: "animal", gender: "neutral", traits: ["mouse", "brave", "tiny", "determined"],
  },
  {
    description: "fluffy polar bear cub, shiny black button nose, round chubby cheeks, snow-white fur, innocent delight",
    type: "animal", gender: "neutral", traits: ["bear", "fluffy", "innocent", "white"],
  },
  {
    description: "majestic unicorn foal, white body, rainbow pastel mane, single golden spiral horn, wide sparkling innocent eyes",
    type: "animal", gender: "neutral", traits: ["unicorn", "magical", "rainbow", "foal"],
  },
  {
    description: "grumpy but secretly kind toad, jewel-bright emerald eyes, sitting cross-armed on a mushroom, hiding a smile",
    type: "animal", gender: "neutral", traits: ["toad", "grumpy", "secretly kind", "funny"],
  },
  {
    description: "sleek black panther, piercing golden eyes, regal calm expression, crouched gracefully, mysterious presence",
    type: "animal", gender: "neutral", traits: ["panther", "regal", "mysterious", "sleek"],
  },
  {
    description: "cheerful sun bear cub, cream chest patch, round ears, cradling a honey jar, irresistible playful smile",
    type: "animal", gender: "neutral", traits: ["bear", "cheerful", "playful", "honey"],
  },
  {
    description: "magnificent peacock, iridescent blue-green tail feathers fanned wide, regal proud expression, dazzling colors",
    type: "animal", gender: "neutral", traits: ["peacock", "magnificent", "colorful", "proud"],
  },
];
