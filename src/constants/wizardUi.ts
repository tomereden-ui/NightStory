// Static UI chrome for the Step-by-step ("Bluebell") wizard — everything that
// isn't the narrator's own lines (those live in bluebellScripts.ts).

export interface WizardUiCopy {
  back: string;
  startOver: string;
  skipThisStep: string;
  skip: string;
  yourOwnName: string;
  aMagicalName: string;
  aBraveStranger: string;
  surpriseMe: string;
  thisIsMyHero: string;
  yesImName: (name: string) => string;
  tryAnother: string;
  yourHeroIs: string;
  thisIsTheWorld: string;
  companionNameHint: string;
  namePlaceholder: string;
  thisIsTheCompanion: string;
  thisIsTheChallenge: string;
  thisIsTheEnding: string;
  bedtimeBadge: string;
  hero: string;
  world: string;
  companion: string;
  challenge: string;
  ending: string;
  edit: string;
  storyLength: string;
  short: string;
  medium: string;
  long: string;
  readyToHearStory: string;
  bluebellLabel: string;
  areYouReady: string;
  producingDrama: string;
  dramaReady: string;
  storySuffix: string;
}

const EN: WizardUiCopy = {
  back: "Back",
  startOver: "Start over",
  skipThisStep: "Skip this step →",
  skip: "Skip →",
  yourOwnName: "Your own name",
  aMagicalName: "A magical name",
  aBraveStranger: "A brave stranger",
  surpriseMe: "Surprise me!",
  thisIsMyHero: "This is my hero!",
  yesImName: (name) => `Yes, I'm ${name}!`,
  tryAnother: "Try another 🎲",
  yourHeroIs: "Your hero is…",
  thisIsTheWorld: "This is the world!",
  companionNameHint: "Give them a name — or leave it blank and Bluebell will choose!",
  namePlaceholder: "Name (optional)",
  thisIsTheCompanion: "This is the companion!",
  thisIsTheChallenge: "This is the challenge!",
  thisIsTheEnding: "This is the ending!",
  bedtimeBadge: "bedtime ❖",
  hero: "Hero",
  world: "World",
  companion: "Companion",
  challenge: "Challenge",
  ending: "Ending",
  edit: "edit",
  storyLength: "Story Length",
  short: "Short",
  medium: "Medium",
  long: "Long",
  readyToHearStory: "Ready to hear the story?",
  bluebellLabel: "Bluebell",
  areYouReady: "Are you ready?",
  producingDrama: "Producing Drama",
  dramaReady: "Drama Ready",
  storySuffix: "'s Story",
};

const HE: WizardUiCopy = {
  back: "חזרה",
  startOver: "התחל מחדש",
  skipThisStep: "דלג על שלב זה ←",
  skip: "דלג ←",
  yourOwnName: "השם שלך",
  aMagicalName: "שם קסום",
  aBraveStranger: "זר אמיץ",
  surpriseMe: "הפתיעו אותי!",
  thisIsMyHero: "זה הגיבור שלי!",
  yesImName: (name) => `כן, אני ${name}!`,
  tryAnother: "נסה שוב 🎲",
  yourHeroIs: "הגיבור שלך הוא…",
  thisIsTheWorld: "זה העולם!",
  companionNameHint: "תן להם שם — או השאר ריק ובלובל תבחר!",
  namePlaceholder: "שם (רשות)",
  thisIsTheCompanion: "זה בן הלוויה!",
  thisIsTheChallenge: "זה האתגר!",
  thisIsTheEnding: "זה הסוף!",
  bedtimeBadge: "לפני השינה ❖",
  hero: "גיבור",
  world: "עולם",
  companion: "בן לוויה",
  challenge: "אתגר",
  ending: "סוף",
  edit: "עריכה",
  storyLength: "אורך הסיפור",
  short: "קצר",
  medium: "בינוני",
  long: "ארוך",
  readyToHearStory: "מוכנים לשמוע את הסיפור?",
  bluebellLabel: "בלובל",
  areYouReady: "מוכנים?",
  producingDrama: "מפיקים דרמה",
  dramaReady: "הדרמה מוכנה",
  storySuffix: " - הסיפור",
};

const ES: WizardUiCopy = {
  back: "Atrás",
  startOver: "Empezar de nuevo",
  skipThisStep: "Saltar este paso →",
  skip: "Saltar →",
  yourOwnName: "Tu propio nombre",
  aMagicalName: "Un nombre mágico",
  aBraveStranger: "Un desconocido valiente",
  surpriseMe: "¡Sorpréndeme!",
  thisIsMyHero: "¡Este es mi héroe!",
  yesImName: (name) => `¡Sí, soy ${name}!`,
  tryAnother: "Probar otro 🎲",
  yourHeroIs: "Tu héroe es…",
  thisIsTheWorld: "¡Este es el mundo!",
  companionNameHint: "Dale un nombre — o déjalo en blanco y Bluebell elegirá!",
  namePlaceholder: "Nombre (opcional)",
  thisIsTheCompanion: "¡Este es el compañero!",
  thisIsTheChallenge: "¡Este es el desafío!",
  thisIsTheEnding: "¡Este es el final!",
  bedtimeBadge: "hora de dormir ❖",
  hero: "Héroe",
  world: "Mundo",
  companion: "Compañero",
  challenge: "Desafío",
  ending: "Final",
  edit: "editar",
  storyLength: "Duración",
  short: "Corta",
  medium: "Media",
  long: "Larga",
  readyToHearStory: "¿Listos para escuchar la historia?",
  bluebellLabel: "Bluebell",
  areYouReady: "¿Listos?",
  producingDrama: "Produciendo la obra",
  dramaReady: "Obra lista",
  storySuffix: ": su historia",
};

const FR: WizardUiCopy = {
  back: "Retour",
  startOver: "Recommencer",
  skipThisStep: "Passer cette étape →",
  skip: "Passer →",
  yourOwnName: "Ton propre nom",
  aMagicalName: "Un nom magique",
  aBraveStranger: "Un inconnu courageux",
  surpriseMe: "Surprends-moi !",
  thisIsMyHero: "C'est mon héros !",
  yesImName: (name) => `Oui, je suis ${name} !`,
  tryAnother: "Essayer un autre 🎲",
  yourHeroIs: "Ton héros est…",
  thisIsTheWorld: "C'est le monde !",
  companionNameHint: "Donne-lui un nom — ou laisse vide et Bluebell choisira !",
  namePlaceholder: "Nom (facultatif)",
  thisIsTheCompanion: "C'est le compagnon !",
  thisIsTheChallenge: "C'est le défi !",
  thisIsTheEnding: "C'est la fin !",
  bedtimeBadge: "coucher ❖",
  hero: "Héros",
  world: "Monde",
  companion: "Compagnon",
  challenge: "Défi",
  ending: "Fin",
  edit: "modifier",
  storyLength: "Durée de l'histoire",
  short: "Courte",
  medium: "Moyenne",
  long: "Longue",
  readyToHearStory: "Prêt à écouter l'histoire ?",
  bluebellLabel: "Bluebell",
  areYouReady: "Prêts ?",
  producingDrama: "Production en cours",
  dramaReady: "Histoire prête",
  storySuffix: " : son histoire",
};

const DE: WizardUiCopy = {
  back: "Zurück",
  startOver: "Neu starten",
  skipThisStep: "Diesen Schritt überspringen →",
  skip: "Überspringen →",
  yourOwnName: "Dein eigener Name",
  aMagicalName: "Ein magischer Name",
  aBraveStranger: "Ein mutiger Fremder",
  surpriseMe: "Überrasch mich!",
  thisIsMyHero: "Das ist mein Held!",
  yesImName: (name) => `Ja, ich bin ${name}!`,
  tryAnother: "Anderen versuchen 🎲",
  yourHeroIs: "Dein Held ist…",
  thisIsTheWorld: "Das ist die Welt!",
  companionNameHint: "Gib ihm einen Namen — oder lass es leer und Bluebell wählt!",
  namePlaceholder: "Name (optional)",
  thisIsTheCompanion: "Das ist der Begleiter!",
  thisIsTheChallenge: "Das ist die Herausforderung!",
  thisIsTheEnding: "Das ist das Ende!",
  bedtimeBadge: "Schlafenszeit ❖",
  hero: "Held",
  world: "Welt",
  companion: "Begleiter",
  challenge: "Herausforderung",
  ending: "Ende",
  edit: "bearbeiten",
  storyLength: "Geschichtenlänge",
  short: "Kurz",
  medium: "Mittel",
  long: "Lang",
  readyToHearStory: "Bereit, die Geschichte zu hören?",
  bluebellLabel: "Bluebell",
  areYouReady: "Bereit?",
  producingDrama: "Hörspiel wird produziert",
  dramaReady: "Hörspiel fertig",
  storySuffix: "s Geschichte",
};

const PT: WizardUiCopy = {
  back: "Voltar",
  startOver: "Recomeçar",
  skipThisStep: "Pular esta etapa →",
  skip: "Pular →",
  yourOwnName: "Seu próprio nome",
  aMagicalName: "Um nome mágico",
  aBraveStranger: "Um estranho corajoso",
  surpriseMe: "Me surpreenda!",
  thisIsMyHero: "Este é o meu herói!",
  yesImName: (name) => `Sim, eu sou ${name}!`,
  tryAnother: "Tentar outro 🎲",
  yourHeroIs: "Seu herói é…",
  thisIsTheWorld: "Este é o mundo!",
  companionNameHint: "Dê um nome a ele — ou deixe em branco e o Bluebell escolherá!",
  namePlaceholder: "Nome (opcional)",
  thisIsTheCompanion: "Este é o companheiro!",
  thisIsTheChallenge: "Este é o desafio!",
  thisIsTheEnding: "Este é o final!",
  bedtimeBadge: "hora de dormir ❖",
  hero: "Herói",
  world: "Mundo",
  companion: "Companheiro",
  challenge: "Desafio",
  ending: "Final",
  edit: "editar",
  storyLength: "Duração da história",
  short: "Curta",
  medium: "Média",
  long: "Longa",
  readyToHearStory: "Pronto para ouvir a história?",
  bluebellLabel: "Bluebell",
  areYouReady: "Prontos?",
  producingDrama: "Produzindo a peça",
  dramaReady: "Peça pronta",
  storySuffix: ": a história",
};

const IT: WizardUiCopy = {
  back: "Indietro",
  startOver: "Ricomincia",
  skipThisStep: "Salta questo passaggio →",
  skip: "Salta →",
  yourOwnName: "Il tuo nome",
  aMagicalName: "Un nome magico",
  aBraveStranger: "Uno sconosciuto coraggioso",
  surpriseMe: "Sorprendimi!",
  thisIsMyHero: "Questo è il mio eroe!",
  yesImName: (name) => `Sì, sono ${name}!`,
  tryAnother: "Provane un altro 🎲",
  yourHeroIs: "Il tuo eroe è…",
  thisIsTheWorld: "Questo è il mondo!",
  companionNameHint: "Dagli un nome — o lascia vuoto e Bluebell sceglierà!",
  namePlaceholder: "Nome (facoltativo)",
  thisIsTheCompanion: "Questo è il compagno!",
  thisIsTheChallenge: "Questa è la sfida!",
  thisIsTheEnding: "Questo è il finale!",
  bedtimeBadge: "buonanotte ❖",
  hero: "Eroe",
  world: "Mondo",
  companion: "Compagno",
  challenge: "Sfida",
  ending: "Finale",
  edit: "modifica",
  storyLength: "Durata della storia",
  short: "Breve",
  medium: "Media",
  long: "Lunga",
  readyToHearStory: "Pronti ad ascoltare la storia?",
  bluebellLabel: "Bluebell",
  areYouReady: "Pronti?",
  producingDrama: "Produzione in corso",
  dramaReady: "Storia pronta",
  storySuffix: ": la sua storia",
};

const AR: WizardUiCopy = {
  back: "رجوع",
  startOver: "البدء من جديد",
  skipThisStep: "تخطي هذه الخطوة ←",
  skip: "تخطي ←",
  yourOwnName: "اسمك الخاص",
  aMagicalName: "اسم سحري",
  aBraveStranger: "غريب شجاع",
  surpriseMe: "فاجئني!",
  thisIsMyHero: "هذا هو بطلي!",
  yesImName: (name) => `نعم، أنا ${name}!`,
  tryAnother: "جرّب آخر 🎲",
  yourHeroIs: "بطلك هو…",
  thisIsTheWorld: "هذا هو العالم!",
  companionNameHint: "أعطه اسماً — أو اتركه فارغاً وستختار بلوبيل!",
  namePlaceholder: "الاسم (اختياري)",
  thisIsTheCompanion: "هذا هو الرفيق!",
  thisIsTheChallenge: "هذا هو التحدي!",
  thisIsTheEnding: "هذه هي النهاية!",
  bedtimeBadge: "وقت النوم ❖",
  hero: "البطل",
  world: "العالم",
  companion: "الرفيق",
  challenge: "التحدي",
  ending: "النهاية",
  edit: "تعديل",
  storyLength: "مدة القصة",
  short: "قصيرة",
  medium: "متوسطة",
  long: "طويلة",
  readyToHearStory: "هل أنت مستعد لسماع القصة؟",
  bluebellLabel: "بلوبيل",
  areYouReady: "هل أنتم مستعدون؟",
  producingDrama: "جاري إنتاج الدراما",
  dramaReady: "الدراما جاهزة",
  storySuffix: ": القصة",
};

const JA: WizardUiCopy = {
  back: "戻る",
  startOver: "最初からやり直す",
  skipThisStep: "このステップをスキップ →",
  skip: "スキップ →",
  yourOwnName: "あなた自身の名前",
  aMagicalName: "魔法の名前",
  aBraveStranger: "勇敢な見知らぬ人",
  surpriseMe: "サプライズして!",
  thisIsMyHero: "これが私のヒーローです!",
  yesImName: (name) => `はい、私は${name}です!`,
  tryAnother: "別のものを試す 🎲",
  yourHeroIs: "あなたのヒーローは…",
  thisIsTheWorld: "これが世界です!",
  companionNameHint: "名前をつけてください——空欄ならブルーベルが選びます!",
  namePlaceholder: "名前(任意)",
  thisIsTheCompanion: "これが仲間です!",
  thisIsTheChallenge: "これが試練です!",
  thisIsTheEnding: "これが結末です!",
  bedtimeBadge: "おやすみ前 ❖",
  hero: "ヒーロー",
  world: "世界",
  companion: "仲間",
  challenge: "試練",
  ending: "結末",
  edit: "編集",
  storyLength: "物語の長さ",
  short: "短い",
  medium: "普通",
  long: "長い",
  readyToHearStory: "物語を聞く準備はいいですか?",
  bluebellLabel: "ブルーベル",
  areYouReady: "準備はいいですか?",
  producingDrama: "ドラマを制作中",
  dramaReady: "ドラマ完成",
  storySuffix: "の物語",
};

const HI: WizardUiCopy = {
  back: "वापस",
  startOver: "फिर से शुरू करें",
  skipThisStep: "यह चरण छोड़ें →",
  skip: "छोड़ें →",
  yourOwnName: "आपका अपना नाम",
  aMagicalName: "एक जादुई नाम",
  aBraveStranger: "एक बहादुर अजनबी",
  surpriseMe: "मुझे चौंका दो!",
  thisIsMyHero: "यह मेरा नायक है!",
  yesImName: (name) => `हाँ, मैं ${name} हूँ!`,
  tryAnother: "दूसरा आज़माएँ 🎲",
  yourHeroIs: "आपका नायक है…",
  thisIsTheWorld: "यह दुनिया है!",
  companionNameHint: "उन्हें एक नाम दें — या खाली छोड़ें और ब्लूबेल चुन लेगी!",
  namePlaceholder: "नाम (वैकल्पिक)",
  thisIsTheCompanion: "यह साथी है!",
  thisIsTheChallenge: "यह चुनौती है!",
  thisIsTheEnding: "यह अंत है!",
  bedtimeBadge: "सोने का समय ❖",
  hero: "नायक",
  world: "दुनिया",
  companion: "साथी",
  challenge: "चुनौती",
  ending: "अंत",
  edit: "बदलें",
  storyLength: "कहानी की लंबाई",
  short: "छोटी",
  medium: "मध्यम",
  long: "लंबी",
  readyToHearStory: "कहानी सुनने के लिए तैयार हैं?",
  bluebellLabel: "ब्लूबेल",
  areYouReady: "तैयार हैं?",
  producingDrama: "नाटक तैयार हो रहा है",
  dramaReady: "नाटक तैयार है",
  storySuffix: " की कहानी",
};

const WIZARD_UI_BY_LANG: Record<string, WizardUiCopy> = { en: EN, he: HE, es: ES, fr: FR, de: DE, pt: PT, it: IT, ar: AR, ja: JA, hi: HI };

export function getWizardUi(language?: string): WizardUiCopy {
  return (language && WIZARD_UI_BY_LANG[language]) || EN;
}

// ─── Card option labels ──────────────────────────────────────────────────
// ids/emojis stay stable (used for image lookup keys); only the display
// label is localized. The English label also still works as a safe seed
// value for story generation since the backend forces the target language.

export interface WorldOptionMeta { id: string; label: string; emoji: string }

const WORLD_IDS: { id: string; emoji: string }[] = [
  { id: "deep-ocean", emoji: "🌊" },
  { id: "enchanted-forest", emoji: "🌳" },
  { id: "space-station", emoji: "🚀" },
  { id: "candy-kingdom", emoji: "🍬" },
  { id: "cloud-village", emoji: "☁️" },
  { id: "underground-caves", emoji: "🕳️" },
  { id: "snowy-mountains", emoji: "🏔️" },
  { id: "desert-oasis", emoji: "🌴" },
  { id: "dragon-kingdom", emoji: "🐉" },
  { id: "pirate-ship", emoji: "🏴‍☠️" },
  { id: "magic-school", emoji: "🏰" },
  { id: "jungle-temple", emoji: "🌿" },
  { id: "time-machine", emoji: "⏰" },
  { id: "volcano-island", emoji: "🌋" },
];

const WORLD_LABELS_BY_LANG: Record<string, Record<string, string>> = {
  en: { "deep-ocean": "Deep ocean", "enchanted-forest": "Enchanted forest", "space-station": "Space station", "candy-kingdom": "Candy kingdom", "cloud-village": "Cloud village", "underground-caves": "Underground caves", "snowy-mountains": "Snowy mountains", "desert-oasis": "Desert oasis", "dragon-kingdom": "Dragon kingdom", "pirate-ship": "Pirate ship", "magic-school": "Magic school", "jungle-temple": "Jungle temple", "time-machine": "Time machine", "volcano-island": "Volcano island" },
  he: { "deep-ocean": "אוקיינוס עמוק", "enchanted-forest": "יער קסום", "space-station": "תחנת חלל", "candy-kingdom": "ממלכת הממתקים", "cloud-village": "כפר העננים", "underground-caves": "מערות תת-קרקעיות", "snowy-mountains": "הרים מושלגים", "desert-oasis": "נווה מדבר", "dragon-kingdom": "ממלכת הדרקונים", "pirate-ship": "ספינת פיראטים", "magic-school": "בית ספר לקסמים", "jungle-temple": "מקדש בג'ונגל", "time-machine": "מכונת זמן", "volcano-island": "אי הר געש" },
  es: { "deep-ocean": "Océano profundo", "enchanted-forest": "Bosque encantado", "space-station": "Estación espacial", "candy-kingdom": "Reino de dulces", "cloud-village": "Aldea de las nubes", "underground-caves": "Cuevas subterráneas", "snowy-mountains": "Montañas nevadas", "desert-oasis": "Oasis del desierto", "dragon-kingdom": "Reino de los dragones", "pirate-ship": "Barco pirata", "magic-school": "Escuela de magia", "jungle-temple": "Templo en la selva", "time-machine": "Máquina del tiempo", "volcano-island": "Isla volcánica" },
  fr: { "deep-ocean": "Océan profond", "enchanted-forest": "Forêt enchantée", "space-station": "Station spatiale", "candy-kingdom": "Royaume des bonbons", "cloud-village": "Village des nuages", "underground-caves": "Grottes souterraines", "snowy-mountains": "Montagnes enneigées", "desert-oasis": "Oasis du désert", "dragon-kingdom": "Royaume des dragons", "pirate-ship": "Bateau pirate", "magic-school": "École de magie", "jungle-temple": "Temple de la jungle", "time-machine": "Machine à voyager dans le temps", "volcano-island": "Île volcanique" },
  de: { "deep-ocean": "Tiefsee", "enchanted-forest": "Verzauberter Wald", "space-station": "Raumstation", "candy-kingdom": "Süßigkeitenreich", "cloud-village": "Wolkendorf", "underground-caves": "Unterirdische Höhlen", "snowy-mountains": "Verschneite Berge", "desert-oasis": "Wüstenoase", "dragon-kingdom": "Drachenreich", "pirate-ship": "Piratenschiff", "magic-school": "Zauberschule", "jungle-temple": "Dschungeltempel", "time-machine": "Zeitmaschine", "volcano-island": "Vulkaninsel" },
  pt: { "deep-ocean": "Oceano profundo", "enchanted-forest": "Floresta encantada", "space-station": "Estação espacial", "candy-kingdom": "Reino dos doces", "cloud-village": "Vila das nuvens", "underground-caves": "Cavernas subterrâneas", "snowy-mountains": "Montanhas nevadas", "desert-oasis": "Oásis do deserto", "dragon-kingdom": "Reino dos dragões", "pirate-ship": "Navio pirata", "magic-school": "Escola de magia", "jungle-temple": "Templo na selva", "time-machine": "Máquina do tempo", "volcano-island": "Ilha vulcânica" },
  it: { "deep-ocean": "Oceano profondo", "enchanted-forest": "Foresta incantata", "space-station": "Stazione spaziale", "candy-kingdom": "Regno delle caramelle", "cloud-village": "Villaggio delle nuvole", "underground-caves": "Grotte sotterranee", "snowy-mountains": "Montagne innevate", "desert-oasis": "Oasi nel deserto", "dragon-kingdom": "Regno dei draghi", "pirate-ship": "Nave pirata", "magic-school": "Scuola di magia", "jungle-temple": "Tempio nella giungla", "time-machine": "Macchina del tempo", "volcano-island": "Isola vulcanica" },
  ar: { "deep-ocean": "المحيط العميق", "enchanted-forest": "الغابة المسحورة", "space-station": "محطة فضائية", "candy-kingdom": "مملكة الحلوى", "cloud-village": "قرية الغيوم", "underground-caves": "كهوف تحت الأرض", "snowy-mountains": "جبال ثلجية", "desert-oasis": "واحة صحراوية", "dragon-kingdom": "مملكة التنانين", "pirate-ship": "سفينة قراصنة", "magic-school": "مدرسة السحر", "jungle-temple": "معبد الأدغال", "time-machine": "آلة الزمن", "volcano-island": "جزيرة بركانية" },
  ja: { "deep-ocean": "深海", "enchanted-forest": "魔法の森", "space-station": "宇宙ステーション", "candy-kingdom": "キャンディ王国", "cloud-village": "雲の村", "underground-caves": "地下洞窟", "snowy-mountains": "雪山", "desert-oasis": "砂漠のオアシス", "dragon-kingdom": "ドラゴン王国", "pirate-ship": "海賊船", "magic-school": "魔法学校", "jungle-temple": "ジャングルの神殿", "time-machine": "タイムマシン", "volcano-island": "火山島" },
  hi: { "deep-ocean": "गहरा समुद्र", "enchanted-forest": "जादुई जंगल", "space-station": "अंतरिक्ष स्टेशन", "candy-kingdom": "कैंडी साम्राज्य", "cloud-village": "बादलों का गाँव", "underground-caves": "भूमिगत गुफाएँ", "snowy-mountains": "बर्फीले पहाड़", "desert-oasis": "रेगिस्तानी नखलिस्तान", "dragon-kingdom": "ड्रैगन साम्राज्य", "pirate-ship": "समुद्री डाकू जहाज़", "magic-school": "जादू स्कूल", "jungle-temple": "जंगल का मंदिर", "time-machine": "समय मशीन", "volcano-island": "ज्वालामुखी द्वीप" },
};

export function getWorldOptions(language?: string): WorldOptionMeta[] {
  const labels = (language && WORLD_LABELS_BY_LANG[language]) || WORLD_LABELS_BY_LANG.en;
  return WORLD_IDS.map(({ id, emoji }) => ({ id, emoji, label: labels[id] ?? WORLD_LABELS_BY_LANG.en[id] }));
}

export type Q3CompanionTypeId = "friend" | "pet" | "creature" | "family";

export interface CompanionTypeMeta { id: Q3CompanionTypeId; label: string; geminiLabel: string; emoji: string; surpriseNames: string[] }

const COMPANION_GEMINI_LABELS: Record<Q3CompanionTypeId, string> = { friend: "best friend", pet: "pet", creature: "magical creature", family: "family member" };
const COMPANION_EMOJI: Record<Q3CompanionTypeId, string> = { friend: "👫", pet: "🐾", creature: "🦄", family: "👨‍👩‍👧" };
const COMPANION_SURPRISE_NAMES: Record<Q3CompanionTypeId, string[]> = {
  friend: ["Mia", "Jake", "Sam", "Theo", "Lily", "Omar", "Priya"],
  pet: ["Biscuit", "Pepper", "Mochi", "Pebble", "Rolo", "Toasty", "Noodle"],
  creature: ["Nimbus", "Ember", "Glimmer", "Pip", "Nova", "Wisp", "Cinder"],
  family: ["Mom", "Dad", "Grandpa", "Grandma", "my brother", "my sister"],
};

const COMPANION_LABELS_BY_LANG: Record<string, Record<Q3CompanionTypeId, string>> = {
  en: { friend: "Best friend", pet: "A pet", creature: "A magical creature", family: "A family member" },
  he: { friend: "חבר הכי טוב", pet: "חיית מחמד", creature: "יצור קסום", family: "בן משפחה" },
  es: { friend: "Mejor amigo", pet: "Una mascota", creature: "Una criatura mágica", family: "Un familiar" },
  fr: { friend: "Meilleur ami", pet: "Un animal de compagnie", creature: "Une créature magique", family: "Un membre de la famille" },
  de: { friend: "Bester Freund", pet: "Ein Haustier", creature: "Ein magisches Wesen", family: "Ein Familienmitglied" },
  pt: { friend: "Melhor amigo", pet: "Um bichinho de estimação", creature: "Uma criatura mágica", family: "Um familiar" },
  it: { friend: "Migliore amico", pet: "Un animale domestico", creature: "Una creatura magica", family: "Un familiare" },
  ar: { friend: "أفضل صديق", pet: "حيوان أليف", creature: "مخلوق سحري", family: "أحد أفراد العائلة" },
  ja: { friend: "親友", pet: "ペット", creature: "魔法の生き物", family: "家族の一員" },
  hi: { friend: "सबसे अच्छा दोस्त", pet: "एक पालतू जानवर", creature: "एक जादुई प्राणी", family: "परिवार का सदस्य" },
};

export function getCompanionTypes(language?: string): CompanionTypeMeta[] {
  const labels = (language && COMPANION_LABELS_BY_LANG[language]) || COMPANION_LABELS_BY_LANG.en;
  return (Object.keys(COMPANION_GEMINI_LABELS) as Q3CompanionTypeId[]).map((id) => ({
    id, label: labels[id], geminiLabel: COMPANION_GEMINI_LABELS[id], emoji: COMPANION_EMOJI[id], surpriseNames: COMPANION_SURPRISE_NAMES[id],
  }));
}

export type Q4CategoryId = "funny" | "spooky" | "weird" | "delicious";

export interface Q4CategoryMeta { id: Q4CategoryId; label: string; emoji: string; placeholder: string; hint: string; examples: string[] }

const Q4_EMOJI: Record<Q4CategoryId, string> = { funny: "😂", spooky: "👻", weird: "🌀", delicious: "🍫" };

const Q4_BY_LANG: Record<string, Record<Q4CategoryId, { label: string; placeholder: string; hint: string; examples: string[] }>> = {
  en: {
    funny: { label: "Funny", placeholder: "like... giant sneezing broccoli", hint: "(e.g. a hiccuping rainbow machine, a cloud that laughs at everything)", examples: ["giant sneezing broccoli", "a hiccuping rainbow machine", "a cloud that laughs at everything"] },
    spooky: { label: "Spooky-fun", placeholder: "like... shadows that giggle", hint: "(e.g. a door that whispers your name backwards, footsteps with no feet)", examples: ["shadows that giggle", "footsteps with no feet", "a door that whispers your name"] },
    weird: { label: "Very weird", placeholder: "like... invisible cheese", hint: "(e.g. mountains that hum lullabies, clocks that run upside down)", examples: ["invisible cheese", "mountains that hum lullabies", "clocks that run upside down"] },
    delicious: { label: "Delicious", placeholder: "like... a river of hot chocolate", hint: "(e.g. flowers that taste like candy floss, rain made of lemonade)", examples: ["a river of hot chocolate", "candy floss flowers", "rain made of lemonade"] },
  },
  he: {
    funny: { label: "מצחיק", placeholder: "כמו... ברוקולי ענק שמתעטש", hint: "(למשל, מכונת קשת שמפריחה שיהוקים, ענן שצוחק על הכל)", examples: ["ברוקולי ענק שמתעטש", "מכונת קשת שמשהקת", "ענן שצוחק על הכל"] },
    spooky: { label: "מפחיד-מצחיק", placeholder: "כמו... צללים שמצחקקים", hint: "(למשל, דלת שלוחשת את שמך הפוך, צעדים בלי רגליים)", examples: ["צללים שמצחקקים", "צעדים בלי רגליים", "דלת שלוחשת את שמך"] },
    weird: { label: "מוזר מאוד", placeholder: "כמו... גבינה שקופה", hint: "(למשל, הרים שמזמזמים שירי ערש, שעונים שרצים הפוך)", examples: ["גבינה שקופה", "הרים שמזמזמים שירי ערש", "שעונים שרצים הפוך"] },
    delicious: { label: "טעים", placeholder: "כמו... נהר של שוקו חם", hint: "(למשל, פרחים שטעימים כמו צמר גפן מתוק, גשם עשוי לימונדה)", examples: ["נהר של שוקו חם", "פרחי צמר גפן מתוק", "גשם עשוי לימונדה"] },
  },
  es: {
    funny: { label: "Divertido", placeholder: "como... un brócoli gigante que estornuda", hint: "(p. ej. una máquina de arcoíris con hipo, una nube que se ríe de todo)", examples: ["un brócoli gigante que estornuda", "una máquina de arcoíris con hipo", "una nube que se ríe de todo"] },
    spooky: { label: "Misterioso-divertido", placeholder: "como... sombras que se ríen tontamente", hint: "(p. ej. una puerta que susurra tu nombre al revés, pasos sin pies)", examples: ["sombras que se ríen tontamente", "pasos sin pies", "una puerta que susurra tu nombre"] },
    weird: { label: "Muy raro", placeholder: "como... queso invisible", hint: "(p. ej. montañas que tararean canciones de cuna, relojes que van al revés)", examples: ["queso invisible", "montañas que tararean canciones de cuna", "relojes que van al revés"] },
    delicious: { label: "Delicioso", placeholder: "como... un río de chocolate caliente", hint: "(p. ej. flores que saben a algodón de azúcar, lluvia de limonada)", examples: ["un río de chocolate caliente", "flores de algodón de azúcar", "lluvia de limonada"] },
  },
  fr: {
    funny: { label: "Drôle", placeholder: "comme... un brocoli géant qui éternue", hint: "(ex. une machine à arc-en-ciel qui a le hoquet, un nuage qui rit de tout)", examples: ["un brocoli géant qui éternue", "une machine à arc-en-ciel qui a le hoquet", "un nuage qui rit de tout"] },
    spooky: { label: "Effrayant-amusant", placeholder: "comme... des ombres qui gloussent", hint: "(ex. une porte qui chuchote ton nom à l'envers, des pas sans pieds)", examples: ["des ombres qui gloussent", "des pas sans pieds", "une porte qui chuchote ton nom"] },
    weird: { label: "Très bizarre", placeholder: "comme... du fromage invisible", hint: "(ex. des montagnes qui fredonnent des berceuses, des horloges à l'envers)", examples: ["du fromage invisible", "des montagnes qui fredonnent des berceuses", "des horloges à l'envers"] },
    delicious: { label: "Délicieux", placeholder: "comme... une rivière de chocolat chaud", hint: "(ex. des fleurs au goût de barbe à papa, de la pluie de limonade)", examples: ["une rivière de chocolat chaud", "des fleurs en barbe à papa", "de la pluie de limonade"] },
  },
  de: {
    funny: { label: "Lustig", placeholder: "wie... ein riesiger niesender Brokkoli", hint: "(z. B. eine schluckaufende Regenbogenmaschine, eine Wolke, die über alles lacht)", examples: ["ein riesiger niesender Brokkoli", "eine schluckaufende Regenbogenmaschine", "eine Wolke, die über alles lacht"] },
    spooky: { label: "Gruselig-lustig", placeholder: "wie... kichernde Schatten", hint: "(z. B. eine Tür, die deinen Namen rückwärts flüstert, Schritte ohne Füße)", examples: ["kichernde Schatten", "Schritte ohne Füße", "eine Tür, die deinen Namen flüstert"] },
    weird: { label: "Sehr seltsam", placeholder: "wie... unsichtbarer Käse", hint: "(z. B. Berge, die Schlaflieder summen, Uhren, die rückwärts laufen)", examples: ["unsichtbarer Käse", "Berge, die Schlaflieder summen", "Uhren, die rückwärts laufen"] },
    delicious: { label: "Lecker", placeholder: "wie... ein Fluss aus heißer Schokolade", hint: "(z. B. Blumen, die nach Zuckerwatte schmecken, Regen aus Limonade)", examples: ["ein Fluss aus heißer Schokolade", "Zuckerwatte-Blumen", "Regen aus Limonade"] },
  },
  pt: {
    funny: { label: "Engraçado", placeholder: "tipo... um brócolis gigante espirrando", hint: "(ex. uma máquina de arco-íris com soluços, uma nuvem que ri de tudo)", examples: ["um brócolis gigante espirrando", "uma máquina de arco-íris com soluços", "uma nuvem que ri de tudo"] },
    spooky: { label: "Assustador-divertido", placeholder: "tipo... sombras que dão risadinhas", hint: "(ex. uma porta que sussurra seu nome ao contrário, passos sem pés)", examples: ["sombras que dão risadinhas", "passos sem pés", "uma porta que sussurra seu nome"] },
    weird: { label: "Muito estranho", placeholder: "tipo... queijo invisível", hint: "(ex. montanhas que cantarolam canções de ninar, relógios que andam ao contrário)", examples: ["queijo invisível", "montanhas que cantarolam canções de ninar", "relógios que andam ao contrário"] },
    delicious: { label: "Delicioso", placeholder: "tipo... um rio de chocolate quente", hint: "(ex. flores com gosto de algodão-doce, chuva de limonada)", examples: ["um rio de chocolate quente", "flores de algodão-doce", "chuva de limonada"] },
  },
  it: {
    funny: { label: "Divertente", placeholder: "tipo... un broccolo gigante che starnutisce", hint: "(es. una macchina arcobaleno col singhiozzo, una nuvola che ride di tutto)", examples: ["un broccolo gigante che starnutisce", "una macchina arcobaleno col singhiozzo", "una nuvola che ride di tutto"] },
    spooky: { label: "Spaventoso-divertente", placeholder: "tipo... ombre che ridacchiano", hint: "(es. una porta che sussurra il tuo nome al contrario, passi senza piedi)", examples: ["ombre che ridacchiano", "passi senza piedi", "una porta che sussurra il tuo nome"] },
    weird: { label: "Molto strano", placeholder: "tipo... formaggio invisibile", hint: "(es. montagne che canticchiano ninne nanne, orologi che vanno al contrario)", examples: ["formaggio invisibile", "montagne che canticchiano ninne nanne", "orologi che vanno al contrario"] },
    delicious: { label: "Delizioso", placeholder: "tipo... un fiume di cioccolata calda", hint: "(es. fiori che sanno di zucchero filato, pioggia di limonata)", examples: ["un fiume di cioccolata calda", "fiori di zucchero filato", "pioggia di limonata"] },
  },
  ar: {
    funny: { label: "مضحك", placeholder: "مثل... بروكلي عملاق يعطس", hint: "(مثال: آلة قوس قزح مصابة بالفواق، سحابة تضحك على كل شيء)", examples: ["بروكلي عملاق يعطس", "آلة قوس قزح مصابة بالفواق", "سحابة تضحك على كل شيء"] },
    spooky: { label: "مخيف-ممتع", placeholder: "مثل... ظلال تضحك بصوت خفيف", hint: "(مثال: باب يهمس باسمك بالعكس، خطوات بلا أقدام)", examples: ["ظلال تضحك بصوت خفيف", "خطوات بلا أقدام", "باب يهمس باسمك"] },
    weird: { label: "غريب جداً", placeholder: "مثل... جبن غير مرئي", hint: "(مثال: جبال تدندن أغاني النوم، ساعات تعمل بالمقلوب)", examples: ["جبن غير مرئي", "جبال تدندن أغاني النوم", "ساعات تعمل بالمقلوب"] },
    delicious: { label: "لذيذ", placeholder: "مثل... نهر من الشوكولاتة الساخنة", hint: "(مثال: زهور طعمها كحلوى القطن، مطر من الليمونادة)", examples: ["نهر من الشوكولاتة الساخنة", "زهور حلوى القطن", "مطر من الليمونادة"] },
  },
  ja: {
    funny: { label: "面白い", placeholder: "例えば…くしゃみをする巨大なブロッコリー", hint: "(例: しゃっくりする虹の機械、何にでも笑う雲)", examples: ["くしゃみをする巨大なブロッコリー", "しゃっくりする虹の機械", "何にでも笑う雲"] },
    spooky: { label: "怖くて楽しい", placeholder: "例えば…クスクス笑う影", hint: "(例: 名前を逆さに囁くドア、足のない足音)", examples: ["クスクス笑う影", "足のない足音", "名前を囁くドア"] },
    weird: { label: "とても奇妙", placeholder: "例えば…見えないチーズ", hint: "(例: 子守唄を口ずさむ山、逆さに動く時計)", examples: ["見えないチーズ", "子守唄を口ずさむ山", "逆さに動く時計"] },
    delicious: { label: "美味しい", placeholder: "例えば…ホットチョコレートの川", hint: "(例: 綿菓子の味がする花、レモネードの雨)", examples: ["ホットチョコレートの川", "綿菓子の花", "レモネードの雨"] },
  },
  hi: {
    funny: { label: "मज़ेदार", placeholder: "जैसे... छींकती हुई विशाल ब्रोकली", hint: "(जैसे, हिचकी लेती इंद्रधनुष मशीन, हर चीज़ पर हँसने वाला बादल)", examples: ["छींकती हुई विशाल ब्रोकली", "हिचकी लेती इंद्रधनुष मशीन", "हर चीज़ पर हँसने वाला बादल"] },
    spooky: { label: "डरावना-मज़ेदार", placeholder: "जैसे... खिलखिलाते साये", hint: "(जैसे, दरवाज़ा जो आपका नाम उल्टा फुसफुसाए, बिना पैरों के कदम)", examples: ["खिलखिलाते साये", "बिना पैरों के कदम", "आपका नाम फुसफुसाता दरवाज़ा"] },
    weird: { label: "बहुत अजीब", placeholder: "जैसे... अदृश्य पनीर", hint: "(जैसे, लोरी गुनगुनाते पहाड़, उल्टी चलने वाली घड़ियाँ)", examples: ["अदृश्य पनीर", "लोरी गुनगुनाते पहाड़", "उल्टी चलने वाली घड़ियाँ"] },
    delicious: { label: "स्वादिष्ट", placeholder: "जैसे... गर्म चॉकलेट की नदी", hint: "(जैसे, कॉटन कैंडी जैसे फूल, नींबू पानी की बारिश)", examples: ["गर्म चॉकलेट की नदी", "कॉटन कैंडी के फूल", "नींबू पानी की बारिश"] },
  },
};

export function getQ4Categories(language?: string): Q4CategoryMeta[] {
  const copy = (language && Q4_BY_LANG[language]) || Q4_BY_LANG.en;
  return (Object.keys(Q4_EMOJI) as Q4CategoryId[]).map((id) => ({ id, emoji: Q4_EMOJI[id], ...copy[id] }));
}
