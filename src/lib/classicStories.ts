// Classic bedtime story definitions. Gemini generates the actual script on first
// request; the result is cached in Supabase Storage and reused on all subsequent loads.

export interface ClassicDef {
  id: string;
  title: string;
  emoji: string;
  tagline: string;
  // Prompt for Pollinations cover art
  coverPrompt: string;
  // Prompt for Gemini script generation
  scriptPrompt: string;
}

export const CLASSIC_STORIES: ClassicDef[] = [
  {
    id: "peter-pan",
    title: "Peter Pan",
    emoji: "✨",
    tagline: "The boy who never grew up",
    coverPrompt:
      "Peter Pan silhouette in green tunic and hat flying over London rooftops at night, Tinkerbell glowing golden beside him, trail of golden pixie-dust stars, deep midnight blue sky packed with sparkles, warm lights in windows below, cinematic children's book illustration, no text",
    scriptPrompt:
      `Write a bedtime story script for "Peter Pan" following the original J.M. Barrie story.
Audience: children aged 4–8. Duration: ~3 minutes when read aloud.
Adapt it faithfully: Peter visits Wendy's nursery window at night, teaches Wendy, John and Michael to fly with pixie dust ("think of a happy thought!"), they fly over London toward the second star to the right, briefly visit Neverland (mermaids, lost boys), and return home to their warm beds as Wendy falls asleep.
Tone: magical, warm, gently exciting, ends peacefully and sleepily.`,
  },
  {
    id: "maya-the-bee",
    title: "Maya the Bee",
    emoji: "🐝",
    tagline: "A little bee who dared to explore",
    coverPrompt:
      "Cute cartoon bumblebee with big expressive eyes flying over village rooftops at golden dusk, trail of amber sparkles, warm orange and deep blue sky filled with glowing four-pointed stars, silhouette of chimneys below, children's book illustration style, no text",
    scriptPrompt:
      `Write a bedtime story script for "Maya the Bee" following the original Waldemar Bonsels story.
Audience: children aged 4–8. Duration: ~3 minutes when read aloud.
Adapt it faithfully: young Maya the bee is born in the hive, curious and adventurous, she sneaks out despite warnings, explores the meadow and meets a butterfly, a cricket, and a grasshopper, gets lost, is helped home by her friend Willy the bee, and falls asleep safely in the hive.
Tone: warm, adventurous but gentle, wonder-filled, ends with Maya sleepily back in her cozy hive.`,
  },
  {
    id: "cinderella",
    title: "Cinderella",
    emoji: "👠",
    tagline: "A glass slipper and a midnight magic",
    coverPrompt:
      "Cinderella in a shimmering blue ball gown descending glowing castle steps at midnight, pumpkin carriage with firefly lights waiting, full moon and starry night sky, magical sparkles swirling, children's book illustration, fairy tale style, no text",
    scriptPrompt:
      `Write a bedtime story script for "Cinderella" following the classic fairy tale.
Audience: children aged 4–8. Duration: ~3 minutes when read aloud.
Adapt it faithfully: kind Cinderella lives with her stepmother and stepsisters, her Fairy Godmother arrives, transforms a pumpkin into a carriage and gives her a beautiful gown, she dances with the prince, runs at midnight leaving a glass slipper, the prince finds her and they live happily ever after.
Tone: dreamy, magical, warm, ends peacefully.`,
  },
  {
    id: "little-red-riding-hood",
    title: "Little Red Riding Hood",
    emoji: "🌻",
    tagline: "Through the forest to grandmother's house",
    coverPrompt:
      "Little girl in red hooded cloak walking through an enchanted moonlit forest path carrying a basket, fireflies and glowing mushrooms, tall cozy trees, a warm cottage light visible ahead, storybook illustration style, soft and magical, no text",
    scriptPrompt:
      `Write a bedtime story script for "Little Red Riding Hood" following the classic fairy tale (use the gentle children's version — wolf is outwitted, no scary ending).
Audience: children aged 4–8. Duration: ~3 minutes when read aloud.
Adapt it faithfully: Little Red carries a basket to grandmother's house through the forest, meets a friendly-seeming wolf, grandmother is hiding safely, a woodcutter arrives, the wolf runs away, Little Red and grandmother share the treats and Red walks home safely as the moon rises.
Tone: adventurous but cozy and reassuring, ends warmly.`,
  },
  {
    id: "goldilocks",
    title: "Goldilocks & the Three Bears",
    emoji: "🐻",
    tagline: "Just right",
    coverPrompt:
      "Goldilocks with golden curly hair tiptoeing through a cozy forest cottage at dusk, three bear-sized chairs visible, warm firelight, twilight outside the windows with stars beginning to appear, storybook illustration style, whimsical and warm, no text",
    scriptPrompt:
      `Write a bedtime story script for "Goldilocks and the Three Bears" following the classic fairy tale.
Audience: children aged 4–8. Duration: ~3 minutes when read aloud.
Adapt it faithfully: Goldilocks finds the bears' cottage, tries the three bowls of porridge (too hot, too cold, just right), tries the chairs (too hard, too soft, just right), tries the beds, falls asleep in Baby Bear's bed, the bears return, Goldilocks wakes and runs home, and falls fast asleep in her own cozy bed.
Tone: gentle, playful, cozy, ends with Goldilocks warm and safe in bed.`,
  },
  {
    id: "the-ugly-duckling",
    title: "The Ugly Duckling",
    emoji: "🦢",
    tagline: "Every swan begins as something different",
    coverPrompt:
      "A graceful white swan gliding on a moonlit lake surrounded by cattails and water lilies, starry night sky reflected in calm water, soft silver and blue glow, other ducks and swans nearby, children's book illustration, dreamy and peaceful, no text",
    scriptPrompt:
      `Write a bedtime story script for "The Ugly Duckling" following the Hans Christian Andersen story.
Audience: children aged 4–8. Duration: ~3 minutes when read aloud.
Adapt it faithfully: a duckling hatches looking different from his siblings, is teased and wanders alone through autumn and a harsh winter, finds shelter with a kind old woman, survives until spring, joins the beautiful swans on a lake, looks at his reflection and discovers he became a swan, welcomed with joy.
Tone: tender, hopeful, gentle, ends with warmth and belonging.`,
  },
];

export type ClassicStatus = "ready" | "generating" | "pending";

export interface ClassicMeta {
  id: string;
  title: string;
  emoji: string;
  tagline: string;
  coverUrl?: string;
  durationSeconds?: number;
  status: ClassicStatus;
}
