// Static UI chrome for the Step-by-step ("Luna") wizard — everything that
// isn't the narrator's own lines (those live in lunaScripts.ts).

export interface WizardUiCopy {
  back: string;
  startOver: string;
  skipThisStep: string;
  skip: string;
  yourOwnName: string;
  aMagicalName: string;
  aBraveStranger: string;
  /** Q1 hero-identity card: the hero can be a real family member or friend,
   *  same free-text + suggestion-chip mechanism as Q3's "family" companion type. */
  aFamilyMemberOrFriend: string;
  /** Q1 hero-identity card: the hero can be a brave animal — reveals the
   *  species-then-name two-row picker (see AnimalTypeChips), same mechanism
   *  Q3's "pet" companion type uses. */
  aBraveAnimal: string;
  /** Title/aria-label of the "+" chip that lets the child type in an animal
   *  not on the list — submitting it runs an AI check that it's really some
   *  kind of animal before the name-suggestion row appears. */
  addYourOwnAnimal: string;
  /** Submit button label for that same custom-animal check. */
  checkAnimal: string;
  surpriseMe: string;
  thisIsMyHero: string;
  yesImName: (name: string) => string;
  tryAnother: string;
  yourHeroIs: string;
  thisIsTheWorld: string;
  companionNameHint: string;
  namePlaceholder: string;
  /** Shown near Q4's free-text field — leaving it blank is a fully valid
   *  path (Luna picks one of the category's own examples), same pattern as
   *  companionNameHint. */
  challengeHint: string;
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
  /** Unit suffix shown after a duration number, e.g. "5 min" / "5 דק׳". */
  minutesUnit: string;
  /** Luna chat's "create story" button while the request is in flight. */
  writingYourStory: string;
  /** Luna chat's "create story" button before it's clicked. */
  createMyStoryButton: string;
  readyToHearStory: string;
  lunaLabel: string;
  areYouReady: string;
  producingDrama: string;
  dramaReady: string;
  storySuffix: string;
  /** Localized "{type} named {name}" phrase for displaying a companion choice
   *  back to the user — separate from CompanionTypeMeta.geminiLabel, which
   *  stays English for the story-generation prompt. */
  companionDisplay: (typeLabel: string, name?: string) => string;
  orDescribeWorld: string;
  describeYourWorld: string;
  checkingAnswer: string;
  pleaseRephrase: string;
}

const EN: WizardUiCopy = {
  back: "Back",
  startOver: "Start over",
  skipThisStep: "Skip this step →",
  skip: "Skip →",
  yourOwnName: "Your own name",
  aMagicalName: "A magical name",
  aBraveStranger: "A brave stranger",
  aFamilyMemberOrFriend: "Family or a friend",
  aBraveAnimal: "A brave animal",
  addYourOwnAnimal: "Add your own animal",
  checkAnimal: "Check!",
  surpriseMe: "Surprise me!",
  thisIsMyHero: "This is my hero!",
  yesImName: (name) => `Yes, I'm ${name}!`,
  tryAnother: "Try another 🎲",
  yourHeroIs: "Your hero is…",
  thisIsTheWorld: "This is the world!",
  companionNameHint: "Give them a name — or leave it blank and Luna will choose!",
  challengeHint: "Or leave it blank — Luna will surprise you!",
  namePlaceholder: "Name (optional)",
  thisIsTheCompanion: "This is the companion!",
  thisIsTheChallenge: "This is what happens!",
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
  minutesUnit: "min",
  writingYourStory: "Writing your story…",
  createMyStoryButton: "Create my story!",
  readyToHearStory: "Ready to hear the story?",
  lunaLabel: "Luna",
  areYouReady: "Are you ready?",
  producingDrama: "Producing Drama",
  dramaReady: "Drama Ready",
  storySuffix: "'s Story",
  companionDisplay: (type, name) => name ? `${type} named ${name}` : type,
  orDescribeWorld: "Or describe your own world...",
  describeYourWorld: "like... a floating city made of clouds",
  checkingAnswer: "Let me think about that...",
  pleaseRephrase: "Hmm, could you try saying that a different way?",
};

const HE: WizardUiCopy = {
  back: "חזרה",
  startOver: "התחל מחדש",
  skipThisStep: "דלג על שלב זה ←",
  skip: "דלג ←",
  yourOwnName: "השם שלך",
  aMagicalName: "שם קסום",
  aBraveStranger: "זר אמיץ",
  aFamilyMemberOrFriend: "בן משפחה או חבר",
  aBraveAnimal: "חיה אמיצה",
  addYourOwnAnimal: "הוסיפו חיה משלכם",
  checkAnimal: "בדיקה!",
  surpriseMe: "הפתיעו אותי!",
  thisIsMyHero: "זה הגיבור שלי!",
  yesImName: (name) => `כן, אני ${name}!`,
  tryAnother: "נסה שוב 🎲",
  yourHeroIs: "הגיבור שלך הוא…",
  thisIsTheWorld: "זה העולם!",
  companionNameHint: "תן להם שם — או השאר ריק ולונה תבחר!",
  challengeHint: "או השאירו ריק — לונה תפתיע אתכם!",
  namePlaceholder: "שם (רשות)",
  thisIsTheCompanion: "זה בן הלוויה!",
  thisIsTheChallenge: "זה מה שיקרה!",
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
  minutesUnit: "דק׳",
  writingYourStory: "כותבים את הסיפור שלך…",
  createMyStoryButton: "צרו את הסיפור שלי!",
  readyToHearStory: "מוכנים לשמוע את הסיפור?",
  lunaLabel: "לונה",
  areYouReady: "מוכנים?",
  producingDrama: "מפיקים דרמה",
  dramaReady: "הדרמה מוכנה",
  storySuffix: " - הסיפור",
  companionDisplay: (type, name) => name ? `${type} בשם ${name}` : type,
  orDescribeWorld: "או תארו את העולם שלכם...",
  describeYourWorld: "כמו... עיר מרחפת עשויה מעננים",
  checkingAnswer: "רגע, אני חושבת על זה...",
  pleaseRephrase: "הממ, אפשר לנסות לומר את זה קצת אחרת?",
};

const ES: WizardUiCopy = {
  back: "Atrás",
  startOver: "Empezar de nuevo",
  skipThisStep: "Saltar este paso →",
  skip: "Saltar →",
  yourOwnName: "Tu propio nombre",
  aMagicalName: "Un nombre mágico",
  aBraveStranger: "Un desconocido valiente",
  aFamilyMemberOrFriend: "Familia o un amigo",
  aBraveAnimal: "Un animal valiente",
  addYourOwnAnimal: "Añade tu propio animal",
  checkAnimal: "¡Comprobar!",
  surpriseMe: "¡Sorpréndeme!",
  thisIsMyHero: "¡Este es mi héroe!",
  yesImName: (name) => `¡Sí, soy ${name}!`,
  tryAnother: "Probar otro 🎲",
  yourHeroIs: "Tu héroe es…",
  thisIsTheWorld: "¡Este es el mundo!",
  companionNameHint: "Dale un nombre — o déjalo en blanco y Luna elegirá!",
  challengeHint: "O déjalo en blanco — ¡Luna te sorprenderá!",
  namePlaceholder: "Nombre (opcional)",
  thisIsTheCompanion: "¡Este es el compañero!",
  thisIsTheChallenge: "¡Esto es lo que pasa!",
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
  minutesUnit: "min",
  writingYourStory: "Escribiendo tu historia…",
  createMyStoryButton: "¡Crea mi historia!",
  readyToHearStory: "¿Listos para escuchar la historia?",
  lunaLabel: "Luna",
  areYouReady: "¿Listos?",
  producingDrama: "Produciendo la obra",
  dramaReady: "Obra lista",
  storySuffix: ": su historia",
  companionDisplay: (type, name) => name ? `${type}, de nombre ${name}` : type,
  orDescribeWorld: "O describe tu propio mundo...",
  describeYourWorld: "como... una ciudad flotante hecha de nubes",
  checkingAnswer: "Déjame pensarlo...",
  pleaseRephrase: "Mmm, ¿puedes intentar decirlo de otra manera?",
};

const FR: WizardUiCopy = {
  back: "Retour",
  startOver: "Recommencer",
  skipThisStep: "Passer cette étape →",
  skip: "Passer →",
  yourOwnName: "Ton propre nom",
  aMagicalName: "Un nom magique",
  aBraveStranger: "Un inconnu courageux",
  aFamilyMemberOrFriend: "Famille ou un ami",
  aBraveAnimal: "Un animal courageux",
  addYourOwnAnimal: "Ajoute ton propre animal",
  checkAnimal: "Vérifier !",
  surpriseMe: "Surprends-moi !",
  thisIsMyHero: "C'est mon héros !",
  yesImName: (name) => `Oui, je suis ${name} !`,
  tryAnother: "Essayer un autre 🎲",
  yourHeroIs: "Ton héros est…",
  thisIsTheWorld: "C'est le monde !",
  companionNameHint: "Donne-lui un nom — ou laisse vide et Luna choisira !",
  challengeHint: "Ou laisse vide — Luna te surprendra !",
  namePlaceholder: "Nom (facultatif)",
  thisIsTheCompanion: "C'est le compagnon !",
  thisIsTheChallenge: "Voilà ce qui va se passer !",
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
  minutesUnit: "min",
  writingYourStory: "Écriture de votre histoire…",
  createMyStoryButton: "Créer mon histoire !",
  readyToHearStory: "Prêt à écouter l'histoire ?",
  lunaLabel: "Luna",
  areYouReady: "Prêts ?",
  producingDrama: "Production en cours",
  dramaReady: "Histoire prête",
  storySuffix: " : son histoire",
  companionDisplay: (type, name) => name ? `${type}, du nom de ${name}` : type,
  orDescribeWorld: "Ou décris ton propre monde...",
  describeYourWorld: "comme... une ville flottante faite de nuages",
  checkingAnswer: "Laisse-moi y réfléchir...",
  pleaseRephrase: "Hmm, peux-tu essayer de le dire autrement ?",
};

const DE: WizardUiCopy = {
  back: "Zurück",
  startOver: "Neu starten",
  skipThisStep: "Diesen Schritt überspringen →",
  skip: "Überspringen →",
  yourOwnName: "Dein eigener Name",
  aMagicalName: "Ein magischer Name",
  aBraveStranger: "Ein mutiger Fremder",
  aFamilyMemberOrFriend: "Familie oder ein Freund",
  aBraveAnimal: "Ein mutiges Tier",
  addYourOwnAnimal: "Füg dein eigenes Tier hinzu",
  checkAnimal: "Prüfen!",
  surpriseMe: "Überrasch mich!",
  thisIsMyHero: "Das ist mein Held!",
  yesImName: (name) => `Ja, ich bin ${name}!`,
  tryAnother: "Anderen versuchen 🎲",
  yourHeroIs: "Dein Held ist…",
  thisIsTheWorld: "Das ist die Welt!",
  companionNameHint: "Gib ihm einen Namen — oder lass es leer und Luna wählt!",
  challengeHint: "Oder lass es leer — Luna überrascht dich!",
  namePlaceholder: "Name (optional)",
  thisIsTheCompanion: "Das ist der Begleiter!",
  thisIsTheChallenge: "Das ist, was passiert!",
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
  minutesUnit: "Min",
  writingYourStory: "Deine Geschichte wird geschrieben…",
  createMyStoryButton: "Erstelle meine Geschichte!",
  readyToHearStory: "Bereit, die Geschichte zu hören?",
  lunaLabel: "Luna",
  areYouReady: "Bereit?",
  producingDrama: "Hörspiel wird produziert",
  dramaReady: "Hörspiel fertig",
  storySuffix: "s Geschichte",
  companionDisplay: (type, name) => name ? `${type} namens ${name}` : type,
  orDescribeWorld: "Oder beschreibe deine eigene Welt...",
  describeYourWorld: "wie... eine schwebende Stadt aus Wolken",
  checkingAnswer: "Lass mich darüber nachdenken...",
  pleaseRephrase: "Hmm, kannst du das anders ausdrücken?",
};

const PT: WizardUiCopy = {
  back: "Voltar",
  startOver: "Recomeçar",
  skipThisStep: "Pular esta etapa →",
  skip: "Pular →",
  yourOwnName: "Seu próprio nome",
  aMagicalName: "Um nome mágico",
  aBraveStranger: "Um estranho corajoso",
  aFamilyMemberOrFriend: "Família ou um amigo",
  aBraveAnimal: "Um animal corajoso",
  addYourOwnAnimal: "Adicione seu próprio animal",
  checkAnimal: "Verificar!",
  surpriseMe: "Me surpreenda!",
  thisIsMyHero: "Este é o meu herói!",
  yesImName: (name) => `Sim, eu sou ${name}!`,
  tryAnother: "Tentar outro 🎲",
  yourHeroIs: "Seu herói é…",
  thisIsTheWorld: "Este é o mundo!",
  companionNameHint: "Dê um nome a ele — ou deixe em branco e o Luna escolherá!",
  challengeHint: "Ou deixe em branco — a Luna vai te surpreender!",
  namePlaceholder: "Nome (opcional)",
  thisIsTheCompanion: "Este é o companheiro!",
  thisIsTheChallenge: "É isso que vai acontecer!",
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
  minutesUnit: "min",
  writingYourStory: "Escrevendo sua história…",
  createMyStoryButton: "Criar minha história!",
  readyToHearStory: "Pronto para ouvir a história?",
  lunaLabel: "Luna",
  areYouReady: "Prontos?",
  producingDrama: "Produzindo a peça",
  dramaReady: "Peça pronta",
  storySuffix: ": a história",
  companionDisplay: (type, name) => name ? `${type}, de nome ${name}` : type,
  orDescribeWorld: "Ou descreva seu próprio mundo...",
  describeYourWorld: "tipo... uma cidade flutuante feita de nuvens",
  checkingAnswer: "Deixe-me pensar sobre isso...",
  pleaseRephrase: "Hmm, pode tentar dizer isso de outra forma?",
};

const IT: WizardUiCopy = {
  back: "Indietro",
  startOver: "Ricomincia",
  skipThisStep: "Salta questo passaggio →",
  skip: "Salta →",
  yourOwnName: "Il tuo nome",
  aMagicalName: "Un nome magico",
  aBraveStranger: "Uno sconosciuto coraggioso",
  aFamilyMemberOrFriend: "Famiglia o un amico",
  aBraveAnimal: "Un animale coraggioso",
  addYourOwnAnimal: "Aggiungi il tuo animale",
  checkAnimal: "Verifica!",
  surpriseMe: "Sorprendimi!",
  thisIsMyHero: "Questo è il mio eroe!",
  yesImName: (name) => `Sì, sono ${name}!`,
  tryAnother: "Provane un altro 🎲",
  yourHeroIs: "Il tuo eroe è…",
  thisIsTheWorld: "Questo è il mondo!",
  companionNameHint: "Dagli un nome — o lascia vuoto e Luna sceglierà!",
  challengeHint: "O lascia vuoto — Luna ti sorprenderà!",
  namePlaceholder: "Nome (facoltativo)",
  thisIsTheCompanion: "Questo è il compagno!",
  thisIsTheChallenge: "Ecco cosa succede!",
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
  minutesUnit: "min",
  writingYourStory: "Sto scrivendo la tua storia…",
  createMyStoryButton: "Crea la mia storia!",
  readyToHearStory: "Pronti ad ascoltare la storia?",
  lunaLabel: "Luna",
  areYouReady: "Pronti?",
  producingDrama: "Produzione in corso",
  dramaReady: "Storia pronta",
  storySuffix: ": la sua storia",
  companionDisplay: (type, name) => name ? `${type} di nome ${name}` : type,
  orDescribeWorld: "Oppure descrivi il tuo mondo...",
  describeYourWorld: "tipo... una città fluttuante fatta di nuvole",
  checkingAnswer: "Fammi pensare...",
  pleaseRephrase: "Mmm, puoi provare a dirlo in un altro modo?",
};

const AR: WizardUiCopy = {
  back: "رجوع",
  startOver: "البدء من جديد",
  skipThisStep: "تخطي هذه الخطوة ←",
  skip: "تخطي ←",
  yourOwnName: "اسمك الخاص",
  aMagicalName: "اسم سحري",
  aBraveStranger: "غريب شجاع",
  aFamilyMemberOrFriend: "أحد أفراد العائلة أو صديق",
  aBraveAnimal: "حيوان شجاع",
  addYourOwnAnimal: "أضف حيوانك الخاص",
  checkAnimal: "تحقق!",
  surpriseMe: "فاجئني!",
  thisIsMyHero: "هذا هو بطلي!",
  yesImName: (name) => `نعم، أنا ${name}!`,
  tryAnother: "جرّب آخر 🎲",
  yourHeroIs: "بطلك هو…",
  thisIsTheWorld: "هذا هو العالم!",
  companionNameHint: "أعطه اسماً — أو اتركه فارغاً وستختار لونا!",
  challengeHint: "أو اتركه فارغاً — ستفاجئك لونا!",
  namePlaceholder: "الاسم (اختياري)",
  thisIsTheCompanion: "هذا هو الرفيق!",
  thisIsTheChallenge: "هذا ما سيحدث!",
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
  minutesUnit: "دقيقة",
  writingYourStory: "نكتب قصتك…",
  createMyStoryButton: "أنشئ قصتي!",
  readyToHearStory: "هل أنت مستعد لسماع القصة؟",
  lunaLabel: "لونا",
  areYouReady: "هل أنتم مستعدون؟",
  producingDrama: "جاري إنتاج الدراما",
  dramaReady: "الدراما جاهزة",
  storySuffix: ": القصة",
  companionDisplay: (type, name) => name ? `${type} باسم ${name}` : type,
  orDescribeWorld: "أو صف عالمك الخاص...",
  describeYourWorld: "مثل... مدينة عائمة مصنوعة من الغيوم",
  checkingAnswer: "دعني أفكر في ذلك...",
  pleaseRephrase: "همم، هل يمكنك تجربة قول ذلك بطريقة أخرى؟",
};

const JA: WizardUiCopy = {
  back: "戻る",
  startOver: "最初からやり直す",
  skipThisStep: "このステップをスキップ →",
  skip: "スキップ →",
  yourOwnName: "あなた自身の名前",
  aMagicalName: "魔法の名前",
  aBraveStranger: "勇敢な見知らぬ人",
  aFamilyMemberOrFriend: "家族か友達",
  aBraveAnimal: "勇敢な動物",
  addYourOwnAnimal: "自分の動物を追加",
  checkAnimal: "確認する!",
  surpriseMe: "サプライズして!",
  thisIsMyHero: "これが私のヒーローです!",
  yesImName: (name) => `はい、私は${name}です!`,
  tryAnother: "別のものを試す 🎲",
  yourHeroIs: "あなたのヒーローは…",
  thisIsTheWorld: "これが世界です!",
  companionNameHint: "名前をつけてください——空欄ならルナが選びます!",
  challengeHint: "空欄のままでもOK——ルナが驚かせてくれます!",
  namePlaceholder: "名前(任意)",
  thisIsTheCompanion: "これが仲間です!",
  thisIsTheChallenge: "これが起こることです!",
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
  minutesUnit: "分",
  writingYourStory: "物語を書いています…",
  createMyStoryButton: "物語を作る!",
  readyToHearStory: "物語を聞く準備はいいですか?",
  lunaLabel: "ルナ",
  areYouReady: "準備はいいですか?",
  producingDrama: "ドラマを制作中",
  dramaReady: "ドラマ完成",
  storySuffix: "の物語",
  companionDisplay: (type, name) => name ? `${name}という${type}` : type,
  orDescribeWorld: "または、あなた自身の世界を説明してください…",
  describeYourWorld: "例えば…雲でできた浮遊都市",
  checkingAnswer: "少し考えさせてください…",
  pleaseRephrase: "うーん、別の言い方を試してみてもらえますか?",
};

const HI: WizardUiCopy = {
  back: "वापस",
  startOver: "फिर से शुरू करें",
  skipThisStep: "यह चरण छोड़ें →",
  skip: "छोड़ें →",
  yourOwnName: "आपका अपना नाम",
  aMagicalName: "एक जादुई नाम",
  aBraveStranger: "एक बहादुर अजनबी",
  aFamilyMemberOrFriend: "परिवार या दोस्त",
  aBraveAnimal: "एक बहादुर जानवर",
  addYourOwnAnimal: "अपना खुद का जानवर जोड़ें",
  checkAnimal: "जाँच करें!",
  surpriseMe: "मुझे चौंका दो!",
  thisIsMyHero: "यह मेरा नायक है!",
  yesImName: (name) => `हाँ, मैं ${name} हूँ!`,
  tryAnother: "दूसरा आज़माएँ 🎲",
  yourHeroIs: "आपका नायक है…",
  thisIsTheWorld: "यह दुनिया है!",
  companionNameHint: "उन्हें एक नाम दें — या खाली छोड़ें और लूना चुन लेगी!",
  challengeHint: "या इसे खाली छोड़ दें — लूना आपको चौंका देगी!",
  namePlaceholder: "नाम (वैकल्पिक)",
  thisIsTheCompanion: "यह साथी है!",
  thisIsTheChallenge: "हमारी कहानी में यही होगा!",
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
  minutesUnit: "मिनट",
  writingYourStory: "आपकी कहानी लिखी जा रही है…",
  createMyStoryButton: "मेरी कहानी बनाएं!",
  readyToHearStory: "कहानी सुनने के लिए तैयार हैं?",
  lunaLabel: "लूना",
  areYouReady: "तैयार हैं?",
  producingDrama: "नाटक तैयार हो रहा है",
  dramaReady: "नाटक तैयार है",
  storySuffix: " की कहानी",
  companionDisplay: (type, name) => name ? `${type}, नाम ${name}` : type,
  orDescribeWorld: "या अपनी खुद की दुनिया के बारे में बताएं...",
  describeYourWorld: "जैसे... बादलों से बना एक तैरता हुआ शहर",
  checkingAnswer: "मुझे इसके बारे में सोचने दो...",
  pleaseRephrase: "हम्म, क्या आप इसे किसी और तरीके से कहने की कोशिश कर सकते हैं?",
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

// Localized relationship-word fallback chips for the "family member" companion
// type — used instead of COMPANION_SURPRISE_NAMES.family whenever the story
// language is known, and prepended with the child's real siblings (fetched
// from child_profiles) by the caller when any exist, so this list only needs
// to cover generic relations, not actual names.
const FAMILY_RELATION_WORDS_BY_LANG: Record<string, string[]> = {
  en: ["Mom", "Dad", "Grandpa", "Grandma", "my brother", "my sister"],
  he: ["אמא", "אבא", "סבא", "סבתא", "אח שלי", "אחות שלי"],
  es: ["Mamá", "Papá", "Abuelo", "Abuela", "mi hermano", "mi hermana"],
  fr: ["Maman", "Papa", "Grand-père", "Grand-mère", "mon frère", "ma sœur"],
  de: ["Mama", "Papa", "Opa", "Oma", "mein Bruder", "meine Schwester"],
  pt: ["Mãe", "Pai", "Avô", "Avó", "meu irmão", "minha irmã"],
  it: ["Mamma", "Papà", "Nonno", "Nonna", "mio fratello", "mia sorella"],
  ar: ["أمي", "أبي", "جدي", "جدتي", "أخي", "أختي"],
  ja: ["ママ", "パパ", "おじいちゃん", "おばあちゃん", "お兄ちゃん", "お姉ちゃん"],
  hi: ["मम्मी", "पापा", "दादा", "दादी", "मेरा भाई", "मेरी बहन"],
};

export function getFamilyRelationWords(language?: string): string[] {
  return (language && FAMILY_RELATION_WORDS_BY_LANG[language]) || FAMILY_RELATION_WORDS_BY_LANG.en;
}

// ── Animal types — shared between Q1's "Brave animal" hero option and Q3's
// "pet" companion type. Picking a type narrows the name suggestions to that
// species (Rex/Buddy for a dog, Whiskers/Luna for a cat, etc.) instead of one
// generic pool. Names stay English/proper-noun across all languages, same
// precedent as MAGICAL_NAME_CHIPS/SURPRISE_COMPANIONS elsewhere in this
// wizard — only the type label (dog/cat/tiger/dolphin) needs translation.
export type AnimalTypeId = "dog" | "cat" | "tiger" | "dolphin";

export interface AnimalTypeMeta { id: AnimalTypeId; emoji: string; label: string; names: string[] }

const ANIMAL_EMOJI: Record<AnimalTypeId, string> = { dog: "🐕", cat: "🐈", tiger: "🐅", dolphin: "🐬" };

const ANIMAL_NAMES: Record<AnimalTypeId, string[]> = {
  dog: ["Rex", "Buddy", "Max", "Bella"],
  cat: ["Whiskers", "Luna", "Mittens", "Shadow"],
  tiger: ["Rajah", "Stripes", "Blaze", "Tigress"],
  dolphin: ["Splash", "Marina", "Echo", "Finn"],
};

const ANIMAL_LABELS_BY_LANG: Record<string, Record<AnimalTypeId, string>> = {
  en: { dog: "Dog", cat: "Cat", tiger: "Tiger", dolphin: "Dolphin" },
  he: { dog: "כלב", cat: "חתול", tiger: "טיגריס", dolphin: "דולפין" },
  es: { dog: "Perro", cat: "Gato", tiger: "Tigre", dolphin: "Delfín" },
  fr: { dog: "Chien", cat: "Chat", tiger: "Tigre", dolphin: "Dauphin" },
  de: { dog: "Hund", cat: "Katze", tiger: "Tiger", dolphin: "Delfin" },
  pt: { dog: "Cachorro", cat: "Gato", tiger: "Tigre", dolphin: "Golfinho" },
  it: { dog: "Cane", cat: "Gatto", tiger: "Tigre", dolphin: "Delfino" },
  ar: { dog: "كلب", cat: "قطة", tiger: "نمر", dolphin: "دولفين" },
  ja: { dog: "犬", cat: "猫", tiger: "トラ", dolphin: "イルカ" },
  hi: { dog: "कुत्ता", cat: "बिल्ली", tiger: "बाघ", dolphin: "डॉल्फ़िन" },
};

export function getAnimalTypes(language?: string): AnimalTypeMeta[] {
  const labels = (language && ANIMAL_LABELS_BY_LANG[language]) || ANIMAL_LABELS_BY_LANG.en;
  return (Object.keys(ANIMAL_EMOJI) as AnimalTypeId[]).map((id) => ({
    id, emoji: ANIMAL_EMOJI[id], label: labels[id], names: ANIMAL_NAMES[id],
  }));
}

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
    id, label: labels[id], geminiLabel: COMPANION_GEMINI_LABELS[id], emoji: COMPANION_EMOJI[id],
    surpriseNames: id === "family" ? getFamilyRelationWords(language) : COMPANION_SURPRISE_NAMES[id],
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
