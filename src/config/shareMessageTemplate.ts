// Default "personal message" suggested on the share flow — both the
// ShareSheet compose sheet (src/components/ShareSheet.tsx) and the public
// /story/[id] landing page (src/app/story/[id]/SharePageClient.tsx) read
// from here, so there's one canonical wording per language instead of two
// copies drifting apart.
//
// `[]` is the placeholder for the family's children's names (e.g. "Zoe" or
// "Zoe, Max & Lily") — replaced by formatShareMessage() below. Names are
// pulled from every child profile under the family, not just the ones this
// particular story happens to be tagged for, so the message still reads
// naturally even for stories (like admin-added library content) that were
// never assigned to a specific child.

export interface ShareMessageTemplate {
  /** Used when the family has at least one child profile. Must contain "[]". */
  template: string;
  /** Used when the family has no child profiles at all. */
  fallback: string;
}

export const SHARE_MESSAGE_TEMPLATES: Record<string, ShareMessageTemplate> = {
  en: {
    template: "We made a magical audio adventure for [] today and wanted to share it with you — it feels like a real cinematic experience, made just for bedtime 🌙",
    fallback: "We made a magical audio adventure today and wanted to share it with you — it feels like a real cinematic experience, made just for bedtime 🌙",
  },
  he: {
    template: "יצרנו הרפתקת אודיו קסומה בשביל [] והיום רצינו לשתף אותה איתך, היא מרגישה כמו חוויה קולנועית אמיתית, שנוצרה בדיוק לזמן השינה 🌙",
    fallback: "יצרנו הרפתקת אודיו קסומה והיום רצינו לשתף אותה איתך, היא מרגישה כמו חוויה קולנועית אמיתית, שנוצרה בדיוק לזמן השינה 🌙",
  },
  es: {
    template: "Hoy creamos una aventura de audio mágica para [] y quisimos compartirla contigo — se siente como una verdadera experiencia cinematográfica, creada justo para la hora de dormir 🌙",
    fallback: "Hoy creamos una aventura de audio mágica y quisimos compartirla contigo — se siente como una verdadera experiencia cinematográfica, creada justo para la hora de dormir 🌙",
  },
  fr: {
    template: "Nous avons créé une aventure audio magique pour [] aujourd'hui et avons voulu la partager avec vous — elle ressemble à une véritable expérience cinématographique, faite pour l'heure du coucher 🌙",
    fallback: "Nous avons créé une aventure audio magique aujourd'hui et avons voulu la partager avec vous — elle ressemble à une véritable expérience cinématographique, faite pour l'heure du coucher 🌙",
  },
  de: {
    template: "Wir haben heute ein magisches Hörabenteuer für [] gemacht und wollten es mit dir teilen — es fühlt sich wie ein echtes Kinoerlebnis an, gemacht genau für die Schlafenszeit 🌙",
    fallback: "Wir haben heute ein magisches Hörabenteuer gemacht und wollten es mit dir teilen — es fühlt sich wie ein echtes Kinoerlebnis an, gemacht genau für die Schlafenszeit 🌙",
  },
  pt: {
    template: "Hoje criamos uma aventura sonora mágica para [] e quisemos compartilhá-la com você — parece uma verdadeira experiência cinematográfica, feita para a hora de dormir 🌙",
    fallback: "Hoje criamos uma aventura sonora mágica e quisemos compartilhá-la com você — parece uma verdadeira experiência cinematográfica, feita para a hora de dormir 🌙",
  },
  ar: {
    template: "صنعنا اليوم مغامرة صوتية سحرية من أجل [] وأردنا مشاركتها معك — تبدو كتجربة سينمائية حقيقية، صُنعت خصيصًا لوقت النوم 🌙",
    fallback: "صنعنا اليوم مغامرة صوتية سحرية وأردنا مشاركتها معك — تبدو كتجربة سينمائية حقيقية، صُنعت خصيصًا لوقت النوم 🌙",
  },
  ja: {
    template: "今日、[]のために魔法のオーディオ冒険を作り、あなたと共有したいと思いました — まるで本物の映画のような体験で、寝る前のひとときのために作られています 🌙",
    fallback: "今日、魔法のオーディオ冒険を作り、あなたと共有したいと思いました — まるで本物の映画のような体験で、寝る前のひとときのために作られています 🌙",
  },
  it: {
    template: "Oggi abbiamo creato un'avventura audio magica per [] e abbiamo voluto condividerla con te — sembra una vera esperienza cinematografica, pensata apposta per l'ora della nanna 🌙",
    fallback: "Oggi abbiamo creato un'avventura audio magica e abbiamo voluto condividerla con te — sembra una vera esperienza cinematografica, pensata apposta per l'ora della nanna 🌙",
  },
  hi: {
    template: "आज हमने [] के लिए एक जादुई ऑडियो रोमांच बनाया और इसे आपके साथ साझा करना चाहा — यह बिल्कुल एक असली सिनेमाई अनुभव जैसा लगता है, जो खासतौर पर सोने के समय के लिए बनाया गया है 🌙",
    fallback: "आज हमने एक जादुई ऑडियो रोमांच बनाया और इसे आपके साथ साझा करना चाहा — यह बिल्कुल एक असली सिनेमाई अनुभव जैसा लगता है, जो खासतौर पर सोने के समय के लिए बनाया गया है 🌙",
  },
};

/** Joins names the same way the rest of the app already does: "Zoe", "Zoe & Max", "Zoe, Max & Lily". */
export function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

/** Builds the suggested share message for a language, given every child
 *  profile name under the family (not just the ones this story is tagged
 *  for) — falls back to the no-names variant when the family has none. */
export function formatShareMessage(language: string, familyChildNames: string[]): string {
  const t = SHARE_MESSAGE_TEMPLATES[language] ?? SHARE_MESSAGE_TEMPLATES.en;
  if (familyChildNames.length === 0) return t.fallback;
  return t.template.replace("[]", joinNames(familyChildNames));
}
