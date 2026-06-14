// ElevenLabs voice IDs
const EL = {
  adam:    "pNInz6obpgDQGcFmaJgB", // deep warm male — narrator
  rachel:  "21m00Tcm4TlvDq8ikWAM", // warm expressive female
  arnold:  "VR6AewLTigWG4xSOukaG", // strong bold male
  emily:   "LcfcDJNUP1GQjkzn1xUU", // soft gentle female
  harry:   "SOYHLrjzK2X1ezoPC6cr", // young playful male
  elli:    "MF3mGyEYCl7XYWbV9V6O", // youthful female
  thomas:  "GBv7mTt0atIp3Br8iCZE", // wise elder male
  dorothy: "ThT5KcBeYPX3keUQqHPh", // airy light female
};

const POOL = Object.values(EL);

export class VoiceMap {
  private readonly map = new Map<string, string>();
  private idx = 0;

  assign(characterName: string, voiceStyle = ""): string {
    const key = characterName.toLowerCase().trim();
    if (this.map.has(key)) return this.map.get(key)!;

    const hint = (key + " " + voiceStyle).toLowerCase();
    let voice: string;

    if (/narrator|storyteller/.test(hint)) {
      voice = EL.adam;
    } else if (/child|kid|young|little|boy|girl/.test(hint)) {
      voice = EL.harry;
    } else if (/grandpa|grandma|elder|old|wise/.test(hint)) {
      voice = EL.thomas;
    } else if (/female|woman|girl|she|her/.test(hint)) {
      voice = this.idx % 2 === 0 ? EL.emily : EL.rachel;
      this.idx++;
    } else if (/male|man|boy|he|him/.test(hint)) {
      voice = this.idx % 2 === 0 ? EL.adam : EL.arnold;
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
