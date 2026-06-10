const POOL = [
  "Charon",  // deep, warm male — good for narrators / wise characters
  "Kore",    // soft, gentle female
  "Fenrir",  // strong, expressive male
  "Aoede",   // warm, expressive female
  "Puck",    // bright, playful — good for children
  "Leda",    // youthful female
  "Orbit",   // measured, elder
  "Zephyr",  // airy, light
];

export class VoiceMap {
  private readonly map = new Map<string, string>();
  private idx = 0;

  assign(characterName: string, voiceStyle = ""): string {
    const key = characterName.toLowerCase().trim();
    if (this.map.has(key)) return this.map.get(key)!;

    const hint = (key + " " + voiceStyle).toLowerCase();
    let voice: string;

    if (/narrator|storyteller/.test(hint)) {
      voice = "Charon";
    } else if (/child|kid|young|little|boy|girl/.test(hint)) {
      voice = "Puck";
    } else if (/grandpa|grandma|elder|old|wise/.test(hint)) {
      voice = "Orbit";
    } else if (/female|woman|girl|she|her/.test(hint)) {
      voice = this.idx % 2 === 0 ? "Kore" : "Aoede";
      this.idx++;
    } else if (/male|man|boy|he|him/.test(hint)) {
      voice = this.idx % 2 === 0 ? "Charon" : "Fenrir";
      this.idx++;
    } else {
      voice = POOL[this.idx % POOL.length];
      this.idx++;
    }

    this.map.set(key, voice);
    return voice;
  }

  getAll(): Record<string, string> {
    return Object.fromEntries(this.map);
  }
}
