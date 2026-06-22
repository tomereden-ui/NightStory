// All Bluebell narrator copy lives here — nowhere else.

export const BLUEBELL = {
  q1: "Every adventure needs a hero. Who's ours tonight?",
  q1Confirm: (name: string) => `${name}! Perfect.`,

  q2: (name: string) => `Now — where does ${name}'s world exist?`,
  q2Confirm: (world: string) => `${world}! I can already feel it.`,

  q3: (world: string, name: string) =>
    `${world}! I can already feel it. Now — who travels alongside ${name}?`,
  q3Confirm: (companion: string) => `${companion}! Magnificent.`,

  q4: (companion: string, name: string) =>
    `${companion}! Magnificent. Now — and this is the most important question of all — what is the funniest OR the scariest thing in ${name}'s world?`,
  q4Reaction1: "Oh... that is the most dangerous kind.",
  q4Confirm: (engine: string) => `${engine}... that is EXACTLY right.`,

  q5: (engine: string, name: string) =>
    `${engine}... that is magnificent. Last question: when the adventure ends, how should ${name} feel?`,

  launch: (mood: string, name: string, companion: string, world: string, engine: string) =>
    `${mood}. Then I know exactly how this ends. ${name} — a hero. ${companion} — a loyal companion. ${world}. ${engine}. This story has never existed before tonight. Are you ready?`,

  hereWeGo: "...Here... we... go.",

  q1TextOwn: "What's your name?",
  q1TextStranger: "Give the stranger a name...",
  q3Nudge: "Someone you know? They can be in the story too.",
  q4Hint: "Keep it short — Bluebell works best with one idea.",
  emptyError: "Give Bluebell something to work with!",

  generating: (heroName: string, world: string) => [
    "Bluebell is weaving the tale...",
    `Finding ${heroName}'s voice...`,
    `${world} is taking shape...`,
    "Almost ready...",
  ],
  generatingLong: "Almost there — Bluebell is working on something special...",

  apiError: "Bluebell lost the thread — shall we try again?",
};

export const MOOD_LABELS: Record<string, string> = {
  brave: "Super brave",
  laughing: "Laughing so much",
  surprised: "Wonderfully surprised",
  sleepy: "Warm and sleepy",
};

export const MOOD_PROSE: Record<string, string> = {
  brave:     "triumphant and super brave",
  laughing:  "laughing so much their sides hurt",
  surprised: "wonderfully surprised by something they never expected",
  sleepy:    "warm, peaceful, and gently ready for sleep",
};
