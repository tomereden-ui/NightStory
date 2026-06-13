export const SURPRISE_HERO_NAMES = [
  "Zara", "Finn", "Kira", "Milo", "Wren", "Sage", "Leo", "Isla",
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
