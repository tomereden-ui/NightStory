// Localized display layer + Gemini-facing catalogs for the "Story Builder"
// quick-create flow (src/app/create/story-builder/) — a separate, simpler
// 5-step wizard from the main SBS flow (FiveQuestionFlow.tsx). Same split as
// wizardUi.ts/moodUi.ts elsewhere: preset ids and their English promptText
// stay canonical/English-only (sent to Gemini); only the display label is
// localized.

export interface PresetOption {
  id: string;
  emoji: string;
  /** English-only — spliced into the generation prompt, never shown to the user. */
  promptText: string;
}

export const HERO_PRESETS: PresetOption[] = [
  { id: "brave-boy", emoji: "👦", promptText: "a brave young boy" },
  { id: "smart-girl", emoji: "👧", promptText: "a smart young girl" },
  { id: "fox-cub", emoji: "🦊", promptText: "a curious young fox cub" },
  { id: "unicorn", emoji: "🦄", promptText: "a magical unicorn" },
];

export const COMPANION_PRESETS: PresetOption[] = [
  { id: "puppy", emoji: "🐶", promptText: "a playful puppy" },
  { id: "owl", emoji: "🦉", promptText: "a wise owl" },
  // "Going Solo" — no companion mentioned in the prompt at all.
  { id: "solo", emoji: "❌", promptText: "" },
];

export const SETTING_PRESETS: PresetOption[] = [
  { id: "forest", emoji: "🌳", promptText: "an enchanted forest" },
  { id: "cloud-castle", emoji: "🏰", promptText: "a castle floating on clouds" },
  { id: "candy-planet", emoji: "🪐", promptText: "a candy planet in outer space" },
];

export interface MissionOption {
  id: string;
  emoji: string;
  /** The SEL value this mission is tied to — used as the "character flavor" hint. */
  value: string;
  /** English-only — the plot directive spliced into the MISSION prompt block. */
  promptDirective: string;
}

export const MISSION_PRESETS: MissionOption[] = [
  { id: "lost-toy", emoji: "🧸", value: "Perseverance", promptDirective: "searching for and ultimately finding a beloved lost toy" },
  { id: "help-friend", emoji: "🤝", value: "Kindness", promptDirective: "helping a friend who is in need" },
  { id: "overcome-fear", emoji: "🚪", value: "Bravery", promptDirective: "facing and overcoming a small, relatable fear" },
  { id: "surprise", emoji: "🎁", value: "Sharing", promptDirective: "preparing a surprise for someone they care about" },
];

export interface StoryBuilderUiCopy {
  heroHeadline: string;
  companionHeadline: string;
  settingHeadline: string;
  missionHeadline: string;
  moodHeadline: string;
  myOwnHero: string;
  myOwnCompanion: string;
  myOwnPlace: string;
  heroPlaceholder: string;
  companionPlaceholder: string;
  settingPlaceholder: string;
  surpriseMe: string;
  continueButton: string;
  back: string;
  startOver: string;
  reviewHeadline: string;
  produceAudio: string;
  cast: string;
  checkingAnswer: string;
  pleaseRephrase: string;
  edit: string;
  createStory: string;
  allSet: string;
}

const EN: StoryBuilderUiCopy = {
  heroHeadline: "Who is leading our story today?",
  companionHeadline: "Who is joining the adventure?",
  settingHeadline: "Where are we going?",
  missionHeadline: "What is our mission today?",
  moodHeadline: "How should the story feel?",
  myOwnHero: "My Own Hero",
  myOwnCompanion: "My Own Companion",
  myOwnPlace: "My Own Place",
  heroPlaceholder: "e.g., A smiling dog named Choco",
  companionPlaceholder: "e.g., Grandpa Joe, A golden robot",
  settingPlaceholder: "e.g., Sharon's Kindergarten, Grandma's House",
  surpriseMe: "Surprise Me!",
  continueButton: "Continue",
  back: "Back",
  startOver: "Start over",
  reviewHeadline: "Here's your story!",
  produceAudio: "Produce Audio",
  cast: "Cast",
  checkingAnswer: "Let me think about that...",
  pleaseRephrase: "Hmm, could you try saying that a different way?",
  edit: "edit",
  createStory: "Let's create the magic! ✨",
  allSet: "We're all set!",
};

const HE: StoryBuilderUiCopy = {
  heroHeadline: "מי מוביל את הסיפור שלנו היום?",
  companionHeadline: "מי מצטרף להרפתקה?",
  settingHeadline: "לאן אנחנו הולכים?",
  missionHeadline: "מה המשימה שלנו היום?",
  moodHeadline: "איך הסיפור צריך להרגיש?",
  myOwnHero: "הגיבור שלי",
  myOwnCompanion: "בן הלוויה שלי",
  myOwnPlace: "המקום שלי",
  heroPlaceholder: "לדוגמה: כלב מחייך בשם צ'וקו",
  companionPlaceholder: "לדוגמה: סבא יוסי, רובוט מוזהב",
  settingPlaceholder: "לדוגמה: הגן של שרון, הבית של סבתא",
  surpriseMe: "הפתיעו אותי!",
  continueButton: "המשך",
  back: "חזרה",
  startOver: "התחל מחדש",
  reviewHeadline: "הנה הסיפור שלכם!",
  produceAudio: "הפיקו את השמע",
  cast: "השחקנים",
  checkingAnswer: "רגע, אני חושבת על זה...",
  pleaseRephrase: "הממ, אפשר לנסות לומר את זה קצת אחרת?",
  edit: "עריכה",
  createStory: "בואו ניצור את הקסם! ✨",
  allSet: "הכל מוכן!",
};

const ES: StoryBuilderUiCopy = {
  heroHeadline: "¿Quién lidera nuestra historia hoy?",
  companionHeadline: "¿Quién se une a la aventura?",
  settingHeadline: "¿A dónde vamos?",
  missionHeadline: "¿Cuál es nuestra misión hoy?",
  moodHeadline: "¿Cómo debería sentirse la historia?",
  myOwnHero: "Mi propio héroe",
  myOwnCompanion: "Mi propio compañero",
  myOwnPlace: "Mi propio lugar",
  heroPlaceholder: "p. ej., Un perro sonriente llamado Choco",
  companionPlaceholder: "p. ej., Abuelo Joe, Un robot dorado",
  settingPlaceholder: "p. ej., El jardín de infantes de Sharon, La casa de la abuela",
  surpriseMe: "¡Sorpréndeme!",
  continueButton: "Continuar",
  back: "Atrás",
  startOver: "Empezar de nuevo",
  reviewHeadline: "¡Aquí está tu historia!",
  produceAudio: "Producir audio",
  cast: "Elenco",
  checkingAnswer: "Déjame pensarlo...",
  pleaseRephrase: "Mmm, ¿puedes intentar decirlo de otra manera?",
  edit: "editar",
  createStory: "¡Creemos la magia! ✨",
  allSet: "¡Todo listo!",
};

const FR: StoryBuilderUiCopy = {
  heroHeadline: "Qui mène notre histoire aujourd'hui ?",
  companionHeadline: "Qui rejoint l'aventure ?",
  settingHeadline: "Où allons-nous ?",
  missionHeadline: "Quelle est notre mission aujourd'hui ?",
  moodHeadline: "Quelle ambiance l'histoire devrait-elle avoir ?",
  myOwnHero: "Mon propre héros",
  myOwnCompanion: "Mon propre compagnon",
  myOwnPlace: "Mon propre lieu",
  heroPlaceholder: "ex. Un chien souriant nommé Choco",
  companionPlaceholder: "ex. Papy Joe, Un robot doré",
  settingPlaceholder: "ex. La maternelle de Sharon, La maison de grand-mère",
  surpriseMe: "Surprends-moi !",
  continueButton: "Continuer",
  back: "Retour",
  startOver: "Recommencer",
  reviewHeadline: "Voici votre histoire !",
  produceAudio: "Produire l'audio",
  cast: "Personnages",
  checkingAnswer: "Laisse-moi y réfléchir...",
  pleaseRephrase: "Hmm, peux-tu essayer de le dire autrement ?",
  edit: "modifier",
  createStory: "Créons la magie ! ✨",
  allSet: "Tout est prêt !",
};

const DE: StoryBuilderUiCopy = {
  heroHeadline: "Wer führt unsere Geschichte heute an?",
  companionHeadline: "Wer begleitet uns auf dem Abenteuer?",
  settingHeadline: "Wohin gehen wir?",
  missionHeadline: "Was ist unsere Mission heute?",
  moodHeadline: "Welche Stimmung soll die Geschichte haben?",
  myOwnHero: "Mein eigener Held",
  myOwnCompanion: "Mein eigener Begleiter",
  myOwnPlace: "Mein eigener Ort",
  heroPlaceholder: "z. B. Ein lächelnder Hund namens Choco",
  companionPlaceholder: "z. B. Opa Joe, Ein goldener Roboter",
  settingPlaceholder: "z. B. Sharons Kindergarten, Omas Haus",
  surpriseMe: "Überrasch mich!",
  continueButton: "Weiter",
  back: "Zurück",
  startOver: "Neu starten",
  reviewHeadline: "Hier ist deine Geschichte!",
  produceAudio: "Audio erstellen",
  cast: "Besetzung",
  checkingAnswer: "Lass mich darüber nachdenken...",
  pleaseRephrase: "Hmm, kannst du das anders ausdrücken?",
  edit: "bearbeiten",
  createStory: "Lass uns die Magie erschaffen! ✨",
  allSet: "Alles bereit!",
};

const PT: StoryBuilderUiCopy = {
  heroHeadline: "Quem lidera nossa história hoje?",
  companionHeadline: "Quem se junta à aventura?",
  settingHeadline: "Para onde vamos?",
  missionHeadline: "Qual é a nossa missão hoje?",
  moodHeadline: "Como a história deveria se sentir?",
  myOwnHero: "Meu próprio herói",
  myOwnCompanion: "Meu próprio companheiro",
  myOwnPlace: "Meu próprio lugar",
  heroPlaceholder: "ex.: Um cachorro sorridente chamado Choco",
  companionPlaceholder: "ex.: Vovô Joe, Um robô dourado",
  settingPlaceholder: "ex.: O jardim de infância da Sharon, A casa da vovó",
  surpriseMe: "Me surpreenda!",
  continueButton: "Continuar",
  back: "Voltar",
  startOver: "Recomeçar",
  reviewHeadline: "Aqui está a sua história!",
  produceAudio: "Produzir áudio",
  cast: "Elenco",
  checkingAnswer: "Deixe-me pensar sobre isso...",
  pleaseRephrase: "Hmm, pode tentar dizer isso de outra forma?",
  edit: "editar",
  createStory: "Vamos criar a magia! ✨",
  allSet: "Tudo pronto!",
};

const IT: StoryBuilderUiCopy = {
  heroHeadline: "Chi guida la nostra storia oggi?",
  companionHeadline: "Chi si unisce all'avventura?",
  settingHeadline: "Dove andiamo?",
  missionHeadline: "Qual è la nostra missione oggi?",
  moodHeadline: "Che atmosfera dovrebbe avere la storia?",
  myOwnHero: "Il mio eroe",
  myOwnCompanion: "Il mio compagno",
  myOwnPlace: "Il mio posto",
  heroPlaceholder: "es. Un cane sorridente di nome Choco",
  companionPlaceholder: "es. Nonno Joe, Un robot dorato",
  settingPlaceholder: "es. L'asilo di Sharon, La casa della nonna",
  surpriseMe: "Sorprendimi!",
  continueButton: "Continua",
  back: "Indietro",
  startOver: "Ricomincia",
  reviewHeadline: "Ecco la tua storia!",
  produceAudio: "Produci audio",
  cast: "Personaggi",
  checkingAnswer: "Fammi pensare...",
  pleaseRephrase: "Mmm, puoi provare a dirlo in un altro modo?",
  edit: "modifica",
  createStory: "Creiamo la magia! ✨",
  allSet: "Tutto pronto!",
};

const AR: StoryBuilderUiCopy = {
  heroHeadline: "من يقود قصتنا اليوم؟",
  companionHeadline: "من ينضم إلى المغامرة؟",
  settingHeadline: "إلى أين نذهب؟",
  missionHeadline: "ما هي مهمتنا اليوم؟",
  moodHeadline: "كيف يجب أن تكون أجواء القصة؟",
  myOwnHero: "بطلي الخاص",
  myOwnCompanion: "رفيقي الخاص",
  myOwnPlace: "مكاني الخاص",
  heroPlaceholder: "مثال: كلب مبتسم اسمه تشوكو",
  companionPlaceholder: "مثال: جدو جو، روبوت ذهبي",
  settingPlaceholder: "مثال: روضة شارون، بيت الجدة",
  surpriseMe: "فاجئني!",
  continueButton: "متابعة",
  back: "رجوع",
  startOver: "البدء من جديد",
  reviewHeadline: "هذه قصتك!",
  produceAudio: "إنتاج الصوت",
  cast: "الشخصيات",
  checkingAnswer: "دعني أفكر في ذلك...",
  pleaseRephrase: "همم، هل يمكنك تجربة قول ذلك بطريقة أخرى؟",
  edit: "تعديل",
  createStory: "لنصنع السحر! ✨",
  allSet: "كل شيء جاهز!",
};

const JA: StoryBuilderUiCopy = {
  heroHeadline: "今日は誰が物語を導きますか?",
  companionHeadline: "誰が冒険に参加しますか?",
  settingHeadline: "どこへ行きますか?",
  missionHeadline: "今日のミッションは何ですか?",
  moodHeadline: "物語はどんな雰囲気がいいですか?",
  myOwnHero: "自分だけのヒーロー",
  myOwnCompanion: "自分だけの仲間",
  myOwnPlace: "自分だけの場所",
  heroPlaceholder: "例:チョコという名前の笑顔の犬",
  companionPlaceholder: "例:ジョーおじいちゃん、金色のロボット",
  settingPlaceholder: "例:シャロンの幼稚園、おばあちゃんの家",
  surpriseMe: "サプライズして!",
  continueButton: "続ける",
  back: "戻る",
  startOver: "最初からやり直す",
  reviewHeadline: "あなたの物語ができました!",
  produceAudio: "音声を作成",
  cast: "登場人物",
  checkingAnswer: "少し考えさせてください…",
  pleaseRephrase: "うーん、別の言い方を試してみてもらえますか?",
  edit: "編集",
  createStory: "魔法を作りましょう! ✨",
  allSet: "準備完了です!",
};

const HI: StoryBuilderUiCopy = {
  heroHeadline: "आज हमारी कहानी का नायक कौन है?",
  companionHeadline: "रोमांच में कौन शामिल हो रहा है?",
  settingHeadline: "हम कहाँ जा रहे हैं?",
  missionHeadline: "आज हमारा मिशन क्या है?",
  moodHeadline: "कहानी का माहौल कैसा होना चाहिए?",
  myOwnHero: "मेरा अपना नायक",
  myOwnCompanion: "मेरा अपना साथी",
  myOwnPlace: "मेरी अपनी जगह",
  heroPlaceholder: "जैसे, चोको नाम का मुस्कुराता कुत्ता",
  companionPlaceholder: "जैसे, दादा जो, एक सुनहरा रोबोट",
  settingPlaceholder: "जैसे, शेरोन का किंडरगार्टन, दादी का घर",
  surpriseMe: "मुझे चौंका दो!",
  continueButton: "जारी रखें",
  back: "वापस",
  startOver: "फिर से शुरू करें",
  reviewHeadline: "यह रही आपकी कहानी!",
  produceAudio: "ऑडियो बनाएं",
  cast: "पात्र",
  checkingAnswer: "मुझे इसके बारे में सोचने दो...",
  pleaseRephrase: "हम्म, क्या आप इसे किसी और तरीके से कहने की कोशिश कर सकते हैं?",
  edit: "बदलें",
  createStory: "चलो जादू बनाते हैं! ✨",
  allSet: "सब तैयार है!",
};

const STORY_BUILDER_UI_BY_LANG: Record<string, StoryBuilderUiCopy> = { en: EN, he: HE, es: ES, fr: FR, de: DE, pt: PT, it: IT, ar: AR, ja: JA, hi: HI };

export function getStoryBuilderUi(language?: string): StoryBuilderUiCopy {
  return (language && STORY_BUILDER_UI_BY_LANG[language]) || EN;
}

const HERO_LABELS_BY_LANG: Record<string, Record<string, string>> = {
  en: { "brave-boy": "Brave Boy", "smart-girl": "Smart Girl", "fox-cub": "Curious Fox Cub", unicorn: "Magical Unicorn" },
  he: { "brave-boy": "ילד אמיץ", "smart-girl": "ילדה חכמה", "fox-cub": "גור שועל סקרן", unicorn: "חד-קרן קסום" },
  es: { "brave-boy": "Niño valiente", "smart-girl": "Niña lista", "fox-cub": "Cachorro de zorro curioso", unicorn: "Unicornio mágico" },
  fr: { "brave-boy": "Garçon courageux", "smart-girl": "Fille intelligente", "fox-cub": "Bébé renard curieux", unicorn: "Licorne magique" },
  de: { "brave-boy": "Mutiger Junge", "smart-girl": "Kluges Mädchen", "fox-cub": "Neugieriges Fuchsjunges", unicorn: "Magisches Einhorn" },
  pt: { "brave-boy": "Menino corajoso", "smart-girl": "Menina esperta", "fox-cub": "Filhote de raposa curioso", unicorn: "Unicórnio mágico" },
  it: { "brave-boy": "Ragazzo coraggioso", "smart-girl": "Ragazza intelligente", "fox-cub": "Cucciolo di volpe curioso", unicorn: "Unicorno magico" },
  ar: { "brave-boy": "صبي شجاع", "smart-girl": "فتاة ذكية", "fox-cub": "صغير ثعلب فضولي", unicorn: "وحيد القرن السحري" },
  ja: { "brave-boy": "勇敢な男の子", "smart-girl": "賢い女の子", "fox-cub": "好奇心旺盛な子ギツネ", unicorn: "魔法のユニコーン" },
  hi: { "brave-boy": "बहादुर लड़का", "smart-girl": "समझदार लड़की", "fox-cub": "जिज्ञासु लोमड़ी का बच्चा", unicorn: "जादुई गेंडा" },
};

export function getHeroLabels(language?: string): Record<string, string> {
  return (language && HERO_LABELS_BY_LANG[language]) || HERO_LABELS_BY_LANG.en;
}

const COMPANION_LABELS_BY_LANG: Record<string, Record<string, string>> = {
  en: { puppy: "Playful Puppy", owl: "Wise Owl", solo: "Going Solo" },
  he: { puppy: "גור כלבים משתובב", owl: "ינשוף חכם", solo: "לבד הפעם" },
  es: { puppy: "Cachorro juguetón", owl: "Búho sabio", solo: "Solo esta vez" },
  fr: { puppy: "Chiot joueur", owl: "Hibou sage", solo: "En solo" },
  de: { puppy: "Verspielter Welpe", owl: "Weise Eule", solo: "Ganz allein" },
  pt: { puppy: "Filhote brincalhão", owl: "Coruja sábia", solo: "Sozinho desta vez" },
  it: { puppy: "Cucciolo giocoso", owl: "Gufo saggio", solo: "Da solo" },
  ar: { puppy: "جرو مرح", owl: "بومة حكيمة", solo: "بمفردي" },
  ja: { puppy: "遊び好きな子犬", owl: "賢いフクロウ", solo: "ひとりで" },
  hi: { puppy: "शरारती पिल्ला", owl: "समझदार उल्लू", solo: "अकेले ही" },
};

export function getCompanionLabels(language?: string): Record<string, string> {
  return (language && COMPANION_LABELS_BY_LANG[language]) || COMPANION_LABELS_BY_LANG.en;
}

const SETTING_LABELS_BY_LANG: Record<string, Record<string, string>> = {
  en: { forest: "Enchanted Forest", "cloud-castle": "Cloud Castle", "candy-planet": "Candy Planet in Space" },
  he: { forest: "יער קסום", "cloud-castle": "טירת עננים", "candy-planet": "כוכב הממתקים בחלל" },
  es: { forest: "Bosque encantado", "cloud-castle": "Castillo de nubes", "candy-planet": "Planeta de dulces en el espacio" },
  fr: { forest: "Forêt enchantée", "cloud-castle": "Château de nuages", "candy-planet": "Planète de bonbons dans l'espace" },
  de: { forest: "Verzauberter Wald", "cloud-castle": "Wolkenschloss", "candy-planet": "Bonbon-Planet im Weltraum" },
  pt: { forest: "Floresta encantada", "cloud-castle": "Castelo nas nuvens", "candy-planet": "Planeta de doces no espaço" },
  it: { forest: "Foresta incantata", "cloud-castle": "Castello tra le nuvole", "candy-planet": "Pianeta di caramelle nello spazio" },
  ar: { forest: "الغابة المسحورة", "cloud-castle": "قلعة الغيوم", "candy-planet": "كوكب الحلوى في الفضاء" },
  ja: { forest: "魔法の森", "cloud-castle": "雲の城", "candy-planet": "宇宙のキャンディ惑星" },
  hi: { forest: "जादुई जंगल", "cloud-castle": "बादलों का महल", "candy-planet": "अंतरिक्ष में कैंडी ग्रह" },
};

export function getSettingLabels(language?: string): Record<string, string> {
  return (language && SETTING_LABELS_BY_LANG[language]) || SETTING_LABELS_BY_LANG.en;
}

const MISSION_LABELS_BY_LANG: Record<string, Record<string, string>> = {
  en: { "lost-toy": "Find a lost toy", "help-friend": "Help a friend in need", "overcome-fear": "Overcome a small fear", surprise: "Prepare a surprise" },
  he: { "lost-toy": "מציאת צעצוע אבוד", "help-friend": "עזרה לחבר במצוקה", "overcome-fear": "התגברות על פחד קטן", surprise: "הכנת הפתעה" },
  es: { "lost-toy": "Encontrar un juguete perdido", "help-friend": "Ayudar a un amigo necesitado", "overcome-fear": "Superar un pequeño miedo", surprise: "Preparar una sorpresa" },
  fr: { "lost-toy": "Retrouver un jouet perdu", "help-friend": "Aider un ami dans le besoin", "overcome-fear": "Surmonter une petite peur", surprise: "Préparer une surprise" },
  de: { "lost-toy": "Ein verlorenes Spielzeug finden", "help-friend": "Einem Freund in Not helfen", "overcome-fear": "Eine kleine Angst überwinden", surprise: "Eine Überraschung vorbereiten" },
  pt: { "lost-toy": "Encontrar um brinquedo perdido", "help-friend": "Ajudar um amigo necessitado", "overcome-fear": "Superar um pequeno medo", surprise: "Preparar uma surpresa" },
  it: { "lost-toy": "Trovare un giocattolo perduto", "help-friend": "Aiutare un amico in difficoltà", "overcome-fear": "Superare una piccola paura", surprise: "Preparare una sorpresa" },
  ar: { "lost-toy": "إيجاد لعبة مفقودة", "help-friend": "مساعدة صديق محتاج", "overcome-fear": "التغلب على خوف صغير", surprise: "تحضير مفاجأة" },
  ja: { "lost-toy": "なくしたおもちゃを見つける", "help-friend": "困っている友達を助ける", "overcome-fear": "小さな恐怖を克服する", surprise: "サプライズを準備する" },
  hi: { "lost-toy": "खोया हुआ खिलौना ढूंढना", "help-friend": "ज़रूरतमंद दोस्त की मदद करना", "overcome-fear": "एक छोटे डर पर काबू पाना", surprise: "एक सरप्राइज़ तैयार करना" },
};

export function getMissionLabels(language?: string): Record<string, string> {
  return (language && MISSION_LABELS_BY_LANG[language]) || MISSION_LABELS_BY_LANG.en;
}
