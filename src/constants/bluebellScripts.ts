// All Bluebell narrator copy lives here — nowhere else.

export interface BluebellCopy {
  q1: string;
  q1Confirm: string;
  q2: string;
  q2Confirm: (world: string) => string;
  q3: (world: string) => string;
  q3Confirm: (companion: string) => string;
  q4: (companion: string) => string;
  q4Reaction1: string;
  q4Confirm: (engine: string) => string;
  q5: (engine: string) => string;
  launch: (mood: string, companion: string, world: string, engine: string) => string;
  hereWeGo: string;
  q1TextOwn: string;
  q1TextStranger: string;
  q3Nudge: string;
  q4Hint: string;
  emptyError: string;
  generating: (world: string) => string[];
  generatingLong: string;
  apiError: string;
}

const EN: BluebellCopy = {
  q1: "Every adventure needs a hero. Who's ours tonight?",
  q1Confirm: "Perfect! Our hero is ready.",
  q2: "Now — in what world does our story take place?",
  q2Confirm: (world) => `${world}! I can already feel it.`,
  q3: (world) => `${world}! I can already feel it. Now — who travels alongside our hero?`,
  q3Confirm: (companion) => `${companion}! Magnificent.`,
  q4: (companion) => `${companion}! Magnificent. Now — and this is the most important question of all — what is the funniest OR the scariest thing in our hero's world?`,
  q4Reaction1: "Oh... that is the most dangerous kind.",
  q4Confirm: (engine) => `${engine}... that is EXACTLY right.`,
  q5: (engine) => `${engine}... that is magnificent. Last question: when the adventure ends, how should our hero feel?`,
  launch: (mood, companion, world, engine) =>
    `${mood}. Then I know exactly how this ends. Our hero. ${companion} — a loyal companion. ${world}. ${engine}. This story has never existed before tonight. Are you ready?`,
  hereWeGo: "...Here... we... go.",
  q1TextOwn: "What's your name?",
  q1TextStranger: "Give the stranger a name...",
  q3Nudge: "Someone you know? They can be in the story too.",
  q4Hint: "Keep it short — Bluebell works best with one idea.",
  emptyError: "Give Bluebell something to work with!",
  generating: (world) => [
    "Bluebell is weaving the tale...",
    "Finding our hero's voice...",
    `${world} is taking shape...`,
    "Almost ready...",
  ],
  generatingLong: "Almost there — Bluebell is working on something special...",
  apiError: "Bluebell lost the thread — shall we try again?",
};

const HE: BluebellCopy = {
  q1: "כל הרפתקה צריכה גיבור. מי יהיה הגיבור שלנו הערב?",
  q1Confirm: "מושלם! הגיבור שלנו מוכן.",
  q2: "עכשיו — באיזה עולם מתרחש הסיפור שלנו?",
  q2Confirm: (world) => `${world}! אני כבר יכולה להרגיש את זה.`,
  q3: (world) => `${world}! אני כבר יכולה להרגיש את זה. עכשיו — מי מלווה את הגיבור שלנו?`,
  q3Confirm: (companion) => `${companion}! נהדר.`,
  q4: (companion) => `${companion}! נהדר. עכשיו — וזו השאלה הכי חשובה מכולן — מה הדבר הכי מצחיק או הכי מפחיד בעולם של הגיבור שלנו?`,
  q4Reaction1: "אה... זה הסוג הכי מסוכן.",
  q4Confirm: (engine) => `${engine}... זה בדיוק נכון.`,
  q5: (engine) => `${engine}... זה נהדר. שאלה אחרונה: כשההרפתקה מסתיימת, איך הגיבור שלנו אמור להרגיש?`,
  launch: (mood, companion, world, engine) =>
    `${mood}. אז אני יודעת בדיוק איך זה נגמר. הגיבור שלנו. ${companion} — בן לוויה נאמן. ${world}. ${engine}. הסיפור הזה מעולם לא היה קיים לפני הלילה. מוכנים?`,
  hereWeGo: "...ו... יוצאים... לדרך.",
  q1TextOwn: "מה השם שלך?",
  q1TextStranger: "תן שם לזר...",
  q3Nudge: "מישהו שאתה מכיר? גם הם יכולים להיות בסיפור.",
  q4Hint: "שמרו על זה קצר — בלובל עובדת הכי טוב עם רעיון אחד.",
  emptyError: "תנו לבלובל משהו לעבוד איתו!",
  generating: (world) => [
    "בלובל אורגת את הסיפור...",
    "מוצאת את הקול של הגיבור שלנו...",
    `${world} מקבל צורה...`,
    "כמעט מוכן...",
  ],
  generatingLong: "עוד רגע — בלובל עובדת על משהו מיוחד...",
  apiError: "בלובל איבדה את החוט — ננסה שוב?",
};

const ES: BluebellCopy = {
  q1: "Toda aventura necesita un héroe. ¿Quién será el nuestro esta noche?",
  q1Confirm: "¡Perfecto! Nuestro héroe está listo.",
  q2: "Ahora — ¿en qué mundo transcurre nuestra historia?",
  q2Confirm: (world) => `¡${world}! Ya puedo sentirlo.`,
  q3: (world) => `¡${world}! Ya puedo sentirlo. Ahora — ¿quién viaja junto a nuestro héroe?`,
  q3Confirm: (companion) => `¡${companion}! Magnífico.`,
  q4: (companion) => `¡${companion}! Magnífico. Ahora — y esta es la pregunta más importante de todas — ¿cuál es lo más divertido O lo más aterrador en el mundo de nuestro héroe?`,
  q4Reaction1: "Oh... ese es el tipo más peligroso.",
  q4Confirm: (engine) => `${engine}... eso es EXACTAMENTE correcto.`,
  q5: (engine) => `${engine}... eso es magnífico. Última pregunta: cuando la aventura termine, ¿cómo debería sentirse nuestro héroe?`,
  launch: (mood, companion, world, engine) =>
    `${mood}. Entonces sé exactamente cómo termina esto. Nuestro héroe. ${companion} — un compañero leal. ${world}. ${engine}. Esta historia nunca ha existido antes de esta noche. ¿Listos?`,
  hereWeGo: "...Aquí... vamos...",
  q1TextOwn: "¿Cómo te llamas?",
  q1TextStranger: "Dale un nombre al desconocido...",
  q3Nudge: "¿Alguien que conoces? También puede estar en la historia.",
  q4Hint: "Que sea breve — Bluebell funciona mejor con una sola idea.",
  emptyError: "¡Dale a Bluebell algo con qué trabajar!",
  generating: (world) => [
    "Bluebell está tejiendo el cuento...",
    "Encontrando la voz de nuestro héroe...",
    `${world} está tomando forma...`,
    "Casi listo...",
  ],
  generatingLong: "Ya casi — Bluebell está trabajando en algo especial...",
  apiError: "Bluebell perdió el hilo — ¿lo intentamos de nuevo?",
};

const FR: BluebellCopy = {
  q1: "Chaque aventure a besoin d'un héros. Qui sera le nôtre ce soir ?",
  q1Confirm: "Parfait ! Notre héros est prêt.",
  q2: "Maintenant — dans quel monde notre histoire se déroule-t-elle ?",
  q2Confirm: (world) => `${world} ! Je le sens déjà.`,
  q3: (world) => `${world} ! Je le sens déjà. Maintenant — qui accompagne notre héros ?`,
  q3Confirm: (companion) => `${companion} ! Magnifique.`,
  q4: (companion) => `${companion} ! Magnifique. Maintenant — et c'est la question la plus importante de toutes — quelle est la chose la plus drôle OU la plus effrayante dans le monde de notre héros ?`,
  q4Reaction1: "Oh... c'est le genre le plus dangereux.",
  q4Confirm: (engine) => `${engine}... c'est EXACTEMENT ça.`,
  q5: (engine) => `${engine}... c'est magnifique. Dernière question : quand l'aventure se termine, comment notre héros devrait-il se sentir ?`,
  launch: (mood, companion, world, engine) =>
    `${mood}. Alors je sais exactement comment cela se termine. Notre héros. ${companion} — un compagnon fidèle. ${world}. ${engine}. Cette histoire n'a jamais existé avant ce soir. Prêts ?`,
  hereWeGo: "...Et... on y... va.",
  q1TextOwn: "Quel est ton nom ?",
  q1TextStranger: "Donne un nom à l'inconnu...",
  q3Nudge: "Quelqu'un que tu connais ? Il peut aussi être dans l'histoire.",
  q4Hint: "Reste bref — Bluebell fonctionne mieux avec une seule idée.",
  emptyError: "Donne à Bluebell quelque chose à utiliser !",
  generating: (world) => [
    "Bluebell tisse le récit...",
    "À la recherche de la voix de notre héros...",
    `${world} prend forme...`,
    "Presque prêt...",
  ],
  generatingLong: "Presque là — Bluebell travaille sur quelque chose de spécial...",
  apiError: "Bluebell a perdu le fil — on réessaie ?",
};

const DE: BluebellCopy = {
  q1: "Jedes Abenteuer braucht einen Helden. Wer wird unserer heute Abend sein?",
  q1Confirm: "Perfekt! Unser Held ist bereit.",
  q2: "Jetzt — in welcher Welt spielt unsere Geschichte?",
  q2Confirm: (world) => `${world}! Das kann ich schon spüren.`,
  q3: (world) => `${world}! Das kann ich schon spüren. Jetzt — wer begleitet unseren Helden?`,
  q3Confirm: (companion) => `${companion}! Wunderbar.`,
  q4: (companion) => `${companion}! Wunderbar. Jetzt — und das ist die wichtigste Frage von allen — was ist das Lustigste ODER das Gruseligste in der Welt unseres Helden?`,
  q4Reaction1: "Oh... das ist die gefährlichste Art.",
  q4Confirm: (engine) => `${engine}... das ist GENAU richtig.`,
  q5: (engine) => `${engine}... das ist wunderbar. Letzte Frage: Wenn das Abenteuer endet, wie soll sich unser Held fühlen?`,
  launch: (mood, companion, world, engine) =>
    `${mood}. Dann weiß ich genau, wie das endet. Unser Held. ${companion} — ein treuer Begleiter. ${world}. ${engine}. Diese Geschichte gab es vor heute Nacht noch nie. Bereit?`,
  hereWeGo: "...Und... los... geht's.",
  q1TextOwn: "Wie heißt du?",
  q1TextStranger: "Gib dem Fremden einen Namen...",
  q3Nudge: "Jemand, den du kennst? Er kann auch in der Geschichte vorkommen.",
  q4Hint: "Halte es kurz — Bluebell funktioniert am besten mit einer Idee.",
  emptyError: "Gib Bluebell etwas zum Arbeiten!",
  generating: (world) => [
    "Bluebell webt die Geschichte...",
    "Findet die Stimme unseres Helden...",
    `${world} nimmt Gestalt an...`,
    "Fast fertig...",
  ],
  generatingLong: "Gleich geschafft — Bluebell arbeitet an etwas Besonderem...",
  apiError: "Bluebell hat den Faden verloren — sollen wir es noch einmal versuchen?",
};

const PT: BluebellCopy = {
  q1: "Toda aventura precisa de um herói. Quem será o nosso esta noite?",
  q1Confirm: "Perfeito! Nosso herói está pronto.",
  q2: "Agora — em que mundo nossa história se passa?",
  q2Confirm: (world) => `${world}! Já consigo sentir isso.`,
  q3: (world) => `${world}! Já consigo sentir isso. Agora — quem viaja ao lado do nosso herói?`,
  q3Confirm: (companion) => `${companion}! Magnífico.`,
  q4: (companion) => `${companion}! Magnífico. Agora — e esta é a pergunta mais importante de todas — qual é a coisa mais engraçada OU mais assustadora no mundo do nosso herói?`,
  q4Reaction1: "Oh... esse é o tipo mais perigoso.",
  q4Confirm: (engine) => `${engine}... isso está EXATAMENTE certo.`,
  q5: (engine) => `${engine}... isso é magnífico. Última pergunta: quando a aventura terminar, como nosso herói deve se sentir?`,
  launch: (mood, companion, world, engine) =>
    `${mood}. Então eu sei exatamente como isso termina. Nosso herói. ${companion} — um companheiro leal. ${world}. ${engine}. Esta história nunca existiu antes desta noite. Prontos?`,
  hereWeGo: "...Lá... vamos... nós.",
  q1TextOwn: "Qual é o seu nome?",
  q1TextStranger: "Dê um nome ao estranho...",
  q3Nudge: "Alguém que você conhece? Também pode estar na história.",
  q4Hint: "Seja breve — Bluebell funciona melhor com uma ideia.",
  emptyError: "Dê ao Bluebell algo para trabalhar!",
  generating: (world) => [
    "Bluebell está tecendo a história...",
    "Encontrando a voz do nosso herói...",
    `${world} está tomando forma...`,
    "Quase pronto...",
  ],
  generatingLong: "Quase lá — Bluebell está trabalhando em algo especial...",
  apiError: "Bluebell perdeu o fio — vamos tentar de novo?",
};

const IT: BluebellCopy = {
  q1: "Ogni avventura ha bisogno di un eroe. Chi sarà il nostro stasera?",
  q1Confirm: "Perfetto! Il nostro eroe è pronto.",
  q2: "Ora — in quale mondo si svolge la nostra storia?",
  q2Confirm: (world) => `${world}! Riesco già a sentirlo.`,
  q3: (world) => `${world}! Riesco già a sentirlo. Ora — chi viaggia accanto al nostro eroe?`,
  q3Confirm: (companion) => `${companion}! Magnifico.`,
  q4: (companion) => `${companion}! Magnifico. Ora — ed è la domanda più importante di tutte — qual è la cosa più divertente O più spaventosa nel mondo del nostro eroe?`,
  q4Reaction1: "Oh... quello è il tipo più pericoloso.",
  q4Confirm: (engine) => `${engine}... è ESATTAMENTE giusto.`,
  q5: (engine) => `${engine}... è magnifico. Ultima domanda: quando l'avventura finisce, come dovrebbe sentirsi il nostro eroe?`,
  launch: (mood, companion, world, engine) =>
    `${mood}. Allora so esattamente come finisce. Il nostro eroe. ${companion} — un fedele compagno. ${world}. ${engine}. Questa storia non è mai esistita prima di stanotte. Pronti?`,
  hereWeGo: "...E... si... parte.",
  q1TextOwn: "Come ti chiami?",
  q1TextStranger: "Dai un nome allo sconosciuto...",
  q3Nudge: "Qualcuno che conosci? Può essere nella storia anche lui.",
  q4Hint: "Sii breve — Bluebell funziona meglio con un'unica idea.",
  emptyError: "Dai a Bluebell qualcosa su cui lavorare!",
  generating: (world) => [
    "Bluebell sta tessendo il racconto...",
    "Alla ricerca della voce del nostro eroe...",
    `${world} sta prendendo forma...`,
    "Quasi pronto...",
  ],
  generatingLong: "Ci siamo quasi — Bluebell sta lavorando su qualcosa di speciale...",
  apiError: "Bluebell ha perso il filo — riproviamo?",
};

const AR: BluebellCopy = {
  q1: "كل مغامرة تحتاج إلى بطل. من سيكون بطلنا الليلة؟",
  q1Confirm: "ممتاز! بطلنا جاهز.",
  q2: "الآن — في أي عالم تدور أحداث قصتنا؟",
  q2Confirm: (world) => `${world}! أستطيع أن أشعر بذلك بالفعل.`,
  q3: (world) => `${world}! أستطيع أن أشعر بذلك بالفعل. الآن — من يرافق بطلنا؟`,
  q3Confirm: (companion) => `${companion}! رائع.`,
  q4: (companion) => `${companion}! رائع. الآن — وهذا هو أهم سؤال على الإطلاق — ما هو الشيء الأكثر إضحاكاً أو الأكثر إخافة في عالم بطلنا؟`,
  q4Reaction1: "أوه... هذا هو النوع الأكثر خطورة.",
  q4Confirm: (engine) => `${engine}... هذا صحيح تماماً.`,
  q5: (engine) => `${engine}... هذا رائع. السؤال الأخير: عندما تنتهي المغامرة، كيف يجب أن يشعر بطلنا؟`,
  launch: (mood, companion, world, engine) =>
    `${mood}. إذن أنا أعرف بالضبط كيف ينتهي هذا. بطلنا. ${companion} — رفيق مخلص. ${world}. ${engine}. هذه القصة لم توجد من قبل حتى الليلة. هل أنتم مستعدون؟`,
  hereWeGo: "...ها نحن... ننطلق.",
  q1TextOwn: "ما اسمك؟",
  q1TextStranger: "أعطِ الغريب اسماً...",
  q3Nudge: "شخص تعرفه؟ يمكن أن يكون في القصة أيضاً.",
  q4Hint: "اجعلها قصيرة — بلوبيل تعمل بشكل أفضل مع فكرة واحدة.",
  emptyError: "أعطِ بلوبيل شيئاً للعمل عليه!",
  generating: (world) => [
    "بلوبيل تنسج الحكاية...",
    "تبحث عن صوت بطلنا...",
    `${world} يتشكل...`,
    "على وشك الجاهزية...",
  ],
  generatingLong: "على وشك الانتهاء — بلوبيل تعمل على شيء مميز...",
  apiError: "بلوبيل فقدت الخيط — هل نحاول مرة أخرى؟",
};

const JA: BluebellCopy = {
  q1: "どんな冒険にもヒーローが必要です。今夜のヒーローは誰にしましょうか?",
  q1Confirm: "完璧です!私たちのヒーローの準備ができました。",
  q2: "さあ——私たちの物語はどんな世界で展開しますか?",
  q2Confirm: (world) => `${world}!もう感じられます。`,
  q3: (world) => `${world}!もう感じられます。さあ——私たちのヒーローと一緒に旅するのは誰ですか?`,
  q3Confirm: (companion) => `${companion}!素晴らしい。`,
  q4: (companion) => `${companion}!素晴らしい。さあ——これが一番大事な質問です——私たちのヒーローの世界で一番面白いこと、または一番怖いことは何ですか?`,
  q4Reaction1: "ああ…それは一番危険な種類です。",
  q4Confirm: (engine) => `${engine}…まさにその通りです。`,
  q5: (engine) => `${engine}…素晴らしいです。最後の質問です:冒険が終わるとき、私たちのヒーローはどんな気持ちになるべきですか?`,
  launch: (mood, companion, world, engine) =>
    `${mood}。それなら、これがどう終わるか正確にわかります。私たちのヒーロー。${companion}——忠実な仲間。${world}。${engine}。この物語は今夜まで一度も存在しませんでした。準備はいいですか?`,
  hereWeGo: "…さあ…行き…ましょう。",
  q1TextOwn: "お名前は?",
  q1TextStranger: "見知らぬ人に名前をつけてください…",
  q3Nudge: "知っている人ですか?その人も物語に登場できます。",
  q4Hint: "短くしてください——ブルーベルは一つのアイデアで一番うまく働きます。",
  emptyError: "ブルーベルに何か材料をあげてください!",
  generating: (world) => [
    "ブルーベルが物語を紡いでいます…",
    "私たちのヒーローの声を見つけています…",
    `${world}が形になっています…`,
    "もうすぐです…",
  ],
  generatingLong: "もう少しです——ブルーベルが特別な何かに取り組んでいます…",
  apiError: "ブルーベルが糸を見失いました——もう一度やってみますか?",
};

const HI: BluebellCopy = {
  q1: "हर रोमांच को एक नायक चाहिए। आज रात हमारा नायक कौन होगा?",
  q1Confirm: "एकदम सही! हमारा नायक तैयार है।",
  q2: "अब — हमारी कहानी किस दुनिया में घटित होती है?",
  q2Confirm: (world) => `${world}! मुझे यह पहले से ही महसूस हो रहा है।`,
  q3: (world) => `${world}! मुझे यह पहले से ही महसूस हो रहा है। अब — हमारे नायक के साथ कौन यात्रा करता है?`,
  q3Confirm: (companion) => `${companion}! शानदार।`,
  q4: (companion) => `${companion}! शानदार। अब — और यह सबसे महत्वपूर्ण सवाल है — हमारे नायक की दुनिया में सबसे मज़ेदार या सबसे डरावनी चीज़ क्या है?`,
  q4Reaction1: "ओह... यह सबसे खतरनाक किस्म है।",
  q4Confirm: (engine) => `${engine}... यह बिल्कुल सही है।`,
  q5: (engine) => `${engine}... यह शानदार है। आखिरी सवाल: जब रोमांच खत्म हो, तो हमारे नायक को कैसा महसूस होना चाहिए?`,
  launch: (mood, companion, world, engine) =>
    `${mood}। तो मुझे पता है कि यह कैसे खत्म होगा। हमारा नायक। ${companion} — एक वफादार साथी। ${world}। ${engine}। यह कहानी आज रात से पहले कभी नहीं थी। तैयार हैं?`,
  hereWeGo: "...चलो... चलते... हैं।",
  q1TextOwn: "तुम्हारा नाम क्या है?",
  q1TextStranger: "अजनबी को एक नाम दो...",
  q3Nudge: "कोई जिसे तुम जानते हो? वे भी कहानी में हो सकते हैं।",
  q4Hint: "इसे छोटा रखें — ब्लूबेल एक विचार के साथ सबसे अच्छा काम करती है।",
  emptyError: "ब्लूबेल को काम करने के लिए कुछ दो!",
  generating: (world) => [
    "ब्लूबेल कहानी बुन रही है...",
    "हमारे नायक की आवाज़ ढूंढ रही है...",
    `${world} आकार ले रहा है...`,
    "लगभग तैयार...",
  ],
  generatingLong: "लगभग हो गया — ब्लूबेल किसी खास चीज़ पर काम कर रही है...",
  apiError: "ब्लूबेल ने धागा खो दिया — फिर से कोशिश करें?",
};

const BLUEBELL_BY_LANG: Record<string, BluebellCopy> = { en: EN, he: HE, es: ES, fr: FR, de: DE, pt: PT, it: IT, ar: AR, ja: JA, hi: HI };

/** Localized Bluebell narrator copy for the given language, falling back to English. */
export function getBluebell(language?: string): BluebellCopy {
  return (language && BLUEBELL_BY_LANG[language]) || EN;
}

// Kept for any other importers expecting the flat English object.
export const BLUEBELL = EN;

// Internal prompt-building label (src/app/api/five-question-story/route.ts) —
// deliberately NOT localized: it's fed into the Gemini prompt, not shown to
// the user, matching how SFX descriptions/visualDescriptions stay English.
export const MOOD_LABELS: Record<string, string> = {
  brave: "Super brave",
  laughing: "Laughing so much",
  surprised: "Wonderfully surprised",
  sleepy: "Warm and sleepy",
};

// User-facing mood label shown in the wizard's own UI (SummaryView, launch
// line) — this one DOES need to match the selected story language.
const MOOD_LABELS_DISPLAY_BY_LANG: Record<string, Record<string, string>> = {
  en: MOOD_LABELS,
  he: { brave: "אמיץ מאוד", laughing: "צוחק כל כך הרבה", surprised: "מופתע בצורה נפלאה", sleepy: "חם ומנומנם" },
  es: { brave: "Súper valiente", laughing: "Riendo tanto", surprised: "Maravillosamente sorprendido", sleepy: "Cálido y adormecido" },
  fr: { brave: "Super courageux", laughing: "Riant aux éclats", surprised: "Merveilleusement surpris", sleepy: "Chaud et somnolent" },
  de: { brave: "Super mutig", laughing: "So sehr am Lachen", surprised: "Wunderbar überrascht", sleepy: "Warm und schläfrig" },
  pt: { brave: "Super corajoso", laughing: "Rindo muito", surprised: "Maravilhosamente surpreso", sleepy: "Quentinho e sonolento" },
  it: { brave: "Super coraggioso", laughing: "Ridendo così tanto", surprised: "Meravigliosamente sorpreso", sleepy: "Caldo e assonnato" },
  ar: { brave: "شجاع جداً", laughing: "يضحك كثيراً", surprised: "متفاجئ بشكل رائع", sleepy: "دافئ ونعسان" },
  ja: { brave: "とても勇敢", laughing: "たくさん笑っている", surprised: "素晴らしく驚いている", sleepy: "暖かくて眠たい" },
  hi: { brave: "बहुत बहादुर", laughing: "बहुत हँस रहा", surprised: "अद्भुत रूप से हैरान", sleepy: "गर्म और नींद भरा" },
};

export function getMoodLabels(language?: string): Record<string, string> {
  return (language && MOOD_LABELS_DISPLAY_BY_LANG[language]) || MOOD_LABELS;
}

export const MOOD_PROSE: Record<string, string> = {
  brave:     "triumphant and super brave",
  laughing:  "laughing so much their sides hurt",
  surprised: "wonderfully surprised by something they never expected",
  sleepy:    "warm, peaceful, and gently ready for sleep",
};
