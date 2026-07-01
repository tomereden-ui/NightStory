export const SURPRISE_HERO_NAMES = [
  "Zara", "Finn", "Kira", "Milo", "Wren", "Sage", "Leo", "Isla",
];

export const SURPRISE_HEROES: { figure: string; name: string }[] = [
  { figure: "a brave boy",       name: "Finn"    },
  { figure: "a clever girl",     name: "Zara"    },
  { figure: "a tiny dragon",     name: "Iggy"    },
  { figure: "a sly fox",         name: "Ember"   },
  { figure: "a little frog",     name: "Pip"     },
  { figure: "a friendly bear",   name: "Milo"    },
  { figure: "a curious rabbit",  name: "Wren"    },
  { figure: "a young wizard",    name: "Sage"    },
  { figure: "a small brave dog", name: "Biscuit" },
  { figure: "a daring girl",     name: "Kira"    },
];

export const MAGICAL_NAME_CHIPS = [
  "Zara", "Finn", "Wren", "Milo", "Kira", "Sage", "Leo", "Isla",
];

export const SURPRISE_COMPANIONS = [
  "a tiny elephant who never forgets",
  "a dragon called Pip",
  "a talking fish called Coral",
  "a cloud puff named Nimbus",
  "a fox called Ember",
];

export const SURPRISE_ENGINES = [
  "giant sneezing broccoli",
  "a door that keeps asking you riddles",
  "invisible cheese",
  "a cloud that follows you everywhere",
  "ticklish mountains",
  "a moon that snores",
];

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
