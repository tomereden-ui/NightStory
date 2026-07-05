// All Bluebell narrator copy lives here — nowhere else.

export interface BluebellCopy {
  q1: string;
  q1Confirm: (name: string) => string;
  q2: (name: string) => string;
  q2Confirm: (world: string) => string;
  q3: (world: string, name: string) => string;
  q3Confirm: (companion: string) => string;
  q4: (companion: string, name: string) => string;
  q4Reaction1: string;
  q4Confirm: (engine: string) => string;
  q5: (engine: string, name: string) => string;
  launch: (mood: string, name: string, companion: string, world: string, engine: string) => string;
  hereWeGo: string;
  q1TextOwn: string;
  q1TextStranger: string;
  q3Nudge: string;
  q4Hint: string;
  emptyError: string;
  generating: (heroName: string, world: string) => string[];
  generatingLong: string;
  apiError: string;
}

const EN: BluebellCopy = {
  q1: "Every adventure needs a hero. Who's ours tonight?",
  q1Confirm: (name) => `${name}! Perfect.`,
  q2: (name) => `Now — where does ${name}'s world exist?`,
  q2Confirm: (world) => `${world}! I can already feel it.`,
  q3: (world, name) => `${world}! I can already feel it. Now — who travels alongside ${name}?`,
  q3Confirm: (companion) => `${companion}! Magnificent.`,
  q4: (companion, name) => `${companion}! Magnificent. Now — and this is the most important question of all — what is the funniest OR the scariest thing in ${name}'s world?`,
  q4Reaction1: "Oh... that is the most dangerous kind.",
  q4Confirm: (engine) => `${engine}... that is EXACTLY right.`,
  q5: (engine, name) => `${engine}... that is magnificent. Last question: when the adventure ends, how should ${name} feel?`,
  launch: (mood, name, companion, world, engine) =>
    `${mood}. Then I know exactly how this ends. ${name} — a hero. ${companion} — a loyal companion. ${world}. ${engine}. This story has never existed before tonight. Are you ready?`,
  hereWeGo: "...Here... we... go.",
  q1TextOwn: "What's your name?",
  q1TextStranger: "Give the stranger a name...",
  q3Nudge: "Someone you know? They can be in the story too.",
  q4Hint: "Keep it short — Bluebell works best with one idea.",
  emptyError: "Give Bluebell something to work with!",
  generating: (heroName, world) => [
    "Bluebell is weaving the tale...",
    `Finding ${heroName}'s voice...`,
    `${world} is taking shape...`,
    "Almost ready...",
  ],
  generatingLong: "Almost there — Bluebell is working on something special...",
  apiError: "Bluebell lost the thread — shall we try again?",
};

const HE: BluebellCopy = {
  q1: "כל הרפתקה צריכה גיבור. מי יהיה הגיבור שלנו הערב?",
  q1Confirm: (name) => `${name}! מושלם.`,
  q2: (name) => `עכשיו — היכן נמצא העולם של ${name}?`,
  q2Confirm: (world) => `${world}! אני כבר יכולה להרגיש את זה.`,
  q3: (world, name) => `${world}! אני כבר יכולה להרגיש את זה. עכשיו — מי מלווה את ${name} בדרך?`,
  q3Confirm: (companion) => `${companion}! נהדר.`,
  q4: (companion, name) => `${companion}! נהדר. עכשיו — וזו השאלה הכי חשובה מכולן — מה הדבר הכי מצחיק או הכי מפחיד בעולם של ${name}?`,
  q4Reaction1: "אה... זה הסוג הכי מסוכן.",
  q4Confirm: (engine) => `${engine}... זה בדיוק נכון.`,
  q5: (engine, name) => `${engine}... זה נהדר. שאלה אחרונה: כשההרפתקה מסתיימת, איך ${name} אמור להרגיש?`,
  launch: (mood, name, companion, world, engine) =>
    `${mood}. אז אני יודעת בדיוק איך זה נגמר. ${name} — גיבור. ${companion} — בן לוויה נאמן. ${world}. ${engine}. הסיפור הזה מעולם לא היה קיים לפני הלילה. מוכנים?`,
  hereWeGo: "...ו... יוצאים... לדרך.",
  q1TextOwn: "מה השם שלך?",
  q1TextStranger: "תן שם לזר...",
  q3Nudge: "מישהו שאתה מכיר? גם הם יכולים להיות בסיפור.",
  q4Hint: "שמרו על זה קצר — בלובל עובדת הכי טוב עם רעיון אחד.",
  emptyError: "תנו לבלובל משהו לעבוד איתו!",
  generating: (heroName, world) => [
    "בלובל אורגת את הסיפור...",
    `מוצאת את הקול של ${heroName}...`,
    `${world} מקבל צורה...`,
    "כמעט מוכן...",
  ],
  generatingLong: "עוד רגע — בלובל עובדת על משהו מיוחד...",
  apiError: "בלובל איבדה את החוט — ננסה שוב?",
};

const ES: BluebellCopy = {
  q1: "Toda aventura necesita un héroe. ¿Quién será el nuestro esta noche?",
  q1Confirm: (name) => `¡${name}! Perfecto.`,
  q2: (name) => `Ahora — ¿dónde existe el mundo de ${name}?`,
  q2Confirm: (world) => `¡${world}! Ya puedo sentirlo.`,
  q3: (world, name) => `¡${world}! Ya puedo sentirlo. Ahora — ¿quién viaja junto a ${name}?`,
  q3Confirm: (companion) => `¡${companion}! Magnífico.`,
  q4: (companion, name) => `¡${companion}! Magnífico. Ahora — y esta es la pregunta más importante de todas — ¿cuál es lo más divertido O lo más aterrador en el mundo de ${name}?`,
  q4Reaction1: "Oh... ese es el tipo más peligroso.",
  q4Confirm: (engine) => `${engine}... eso es EXACTAMENTE correcto.`,
  q5: (engine, name) => `${engine}... eso es magnífico. Última pregunta: cuando la aventura termine, ¿cómo debería sentirse ${name}?`,
  launch: (mood, name, companion, world, engine) =>
    `${mood}. Entonces sé exactamente cómo termina esto. ${name} — un héroe. ${companion} — un compañero leal. ${world}. ${engine}. Esta historia nunca ha existido antes de esta noche. ¿Listos?`,
  hereWeGo: "...Aquí... vamos...",
  q1TextOwn: "¿Cómo te llamas?",
  q1TextStranger: "Dale un nombre al desconocido...",
  q3Nudge: "¿Alguien que conoces? También puede estar en la historia.",
  q4Hint: "Que sea breve — Bluebell funciona mejor con una sola idea.",
  emptyError: "¡Dale a Bluebell algo con qué trabajar!",
  generating: (heroName, world) => [
    "Bluebell está tejiendo el cuento...",
    `Encontrando la voz de ${heroName}...`,
    `${world} está tomando forma...`,
    "Casi listo...",
  ],
  generatingLong: "Ya casi — Bluebell está trabajando en algo especial...",
  apiError: "Bluebell perdió el hilo — ¿lo intentamos de nuevo?",
};

const FR: BluebellCopy = {
  q1: "Chaque aventure a besoin d'un héros. Qui sera le nôtre ce soir ?",
  q1Confirm: (name) => `${name} ! Parfait.`,
  q2: (name) => `Maintenant — où se trouve le monde de ${name} ?`,
  q2Confirm: (world) => `${world} ! Je le sens déjà.`,
  q3: (world, name) => `${world} ! Je le sens déjà. Maintenant — qui accompagne ${name} ?`,
  q3Confirm: (companion) => `${companion} ! Magnifique.`,
  q4: (companion, name) => `${companion} ! Magnifique. Maintenant — et c'est la question la plus importante de toutes — quelle est la chose la plus drôle OU la plus effrayante dans le monde de ${name} ?`,
  q4Reaction1: "Oh... c'est le genre le plus dangereux.",
  q4Confirm: (engine) => `${engine}... c'est EXACTEMENT ça.`,
  q5: (engine, name) => `${engine}... c'est magnifique. Dernière question : quand l'aventure se termine, comment ${name} devrait-il se sentir ?`,
  launch: (mood, name, companion, world, engine) =>
    `${mood}. Alors je sais exactement comment cela se termine. ${name} — un héros. ${companion} — un compagnon fidèle. ${world}. ${engine}. Cette histoire n'a jamais existé avant ce soir. Prêts ?`,
  hereWeGo: "...Et... on y... va.",
  q1TextOwn: "Quel est ton nom ?",
  q1TextStranger: "Donne un nom à l'inconnu...",
  q3Nudge: "Quelqu'un que tu connais ? Il peut aussi être dans l'histoire.",
  q4Hint: "Reste bref — Bluebell fonctionne mieux avec une seule idée.",
  emptyError: "Donne à Bluebell quelque chose à utiliser !",
  generating: (heroName, world) => [
    "Bluebell tisse le récit...",
    `À la recherche de la voix de ${heroName}...`,
    `${world} prend forme...`,
    "Presque prêt...",
  ],
  generatingLong: "Presque là — Bluebell travaille sur quelque chose de spécial...",
  apiError: "Bluebell a perdu le fil — on réessaie ?",
};

const DE: BluebellCopy = {
  q1: "Jedes Abenteuer braucht einen Helden. Wer wird unserer heute Abend sein?",
  q1Confirm: (name) => `${name}! Perfekt.`,
  q2: (name) => `Jetzt — wo existiert ${name}s Welt?`,
  q2Confirm: (world) => `${world}! Das kann ich schon spüren.`,
  q3: (world, name) => `${world}! Das kann ich schon spüren. Jetzt — wer begleitet ${name}?`,
  q3Confirm: (companion) => `${companion}! Wunderbar.`,
  q4: (companion, name) => `${companion}! Wunderbar. Jetzt — und das ist die wichtigste Frage von allen — was ist das Lustigste ODER das Gruseligste in ${name}s Welt?`,
  q4Reaction1: "Oh... das ist die gefährlichste Art.",
  q4Confirm: (engine) => `${engine}... das ist GENAU richtig.`,
  q5: (engine, name) => `${engine}... das ist wunderbar. Letzte Frage: Wenn das Abenteuer endet, wie soll sich ${name} fühlen?`,
  launch: (mood, name, companion, world, engine) =>
    `${mood}. Dann weiß ich genau, wie das endet. ${name} — ein Held. ${companion} — ein treuer Begleiter. ${world}. ${engine}. Diese Geschichte gab es vor heute Nacht noch nie. Bereit?`,
  hereWeGo: "...Und... los... geht's.",
  q1TextOwn: "Wie heißt du?",
  q1TextStranger: "Gib dem Fremden einen Namen...",
  q3Nudge: "Jemand, den du kennst? Er kann auch in der Geschichte vorkommen.",
  q4Hint: "Halte es kurz — Bluebell funktioniert am besten mit einer Idee.",
  emptyError: "Gib Bluebell etwas zum Arbeiten!",
  generating: (heroName, world) => [
    "Bluebell webt die Geschichte...",
    `Findet ${heroName}s Stimme...`,
    `${world} nimmt Gestalt an...`,
    "Fast fertig...",
  ],
  generatingLong: "Gleich geschafft — Bluebell arbeitet an etwas Besonderem...",
  apiError: "Bluebell hat den Faden verloren — sollen wir es noch einmal versuchen?",
};

const PT: BluebellCopy = {
  q1: "Toda aventura precisa de um herói. Quem será o nosso esta noite?",
  q1Confirm: (name) => `${name}! Perfeito.`,
  q2: (name) => `Agora — onde existe o mundo de ${name}?`,
  q2Confirm: (world) => `${world}! Já consigo sentir isso.`,
  q3: (world, name) => `${world}! Já consigo sentir isso. Agora — quem viaja ao lado de ${name}?`,
  q3Confirm: (companion) => `${companion}! Magnífico.`,
  q4: (companion, name) => `${companion}! Magnífico. Agora — e esta é a pergunta mais importante de todas — qual é a coisa mais engraçada OU mais assustadora no mundo de ${name}?`,
  q4Reaction1: "Oh... esse é o tipo mais perigoso.",
  q4Confirm: (engine) => `${engine}... isso está EXATAMENTE certo.`,
  q5: (engine, name) => `${engine}... isso é magnífico. Última pergunta: quando a aventura terminar, como ${name} deve se sentir?`,
  launch: (mood, name, companion, world, engine) =>
    `${mood}. Então eu sei exatamente como isso termina. ${name} — um herói. ${companion} — um companheiro leal. ${world}. ${engine}. Esta história nunca existiu antes desta noite. Prontos?`,
  hereWeGo: "...Lá... vamos... nós.",
  q1TextOwn: "Qual é o seu nome?",
  q1TextStranger: "Dê um nome ao estranho...",
  q3Nudge: "Alguém que você conhece? Também pode estar na história.",
  q4Hint: "Seja breve — Bluebell funciona melhor com uma ideia.",
  emptyError: "Dê ao Bluebell algo para trabalhar!",
  generating: (heroName, world) => [
    "Bluebell está tecendo a história...",
    `Encontrando a voz de ${heroName}...`,
    `${world} está tomando forma...`,
    "Quase pronto...",
  ],
  generatingLong: "Quase lá — Bluebell está trabalhando em algo especial...",
  apiError: "Bluebell perdeu o fio — vamos tentar de novo?",
};

const IT: BluebellCopy = {
  q1: "Ogni avventura ha bisogno di un eroe. Chi sarà il nostro stasera?",
  q1Confirm: (name) => `${name}! Perfetto.`,
  q2: (name) => `Ora — dove esiste il mondo di ${name}?`,
  q2Confirm: (world) => `${world}! Riesco già a sentirlo.`,
  q3: (world, name) => `${world}! Riesco già a sentirlo. Ora — chi viaggia accanto a ${name}?`,
  q3Confirm: (companion) => `${companion}! Magnifico.`,
  q4: (companion, name) => `${companion}! Magnifico. Ora — ed è la domanda più importante di tutte — qual è la cosa più divertente O più spaventosa nel mondo di ${name}?`,
  q4Reaction1: "Oh... quello è il tipo più pericoloso.",
  q4Confirm: (engine) => `${engine}... è ESATTAMENTE giusto.`,
  q5: (engine, name) => `${engine}... è magnifico. Ultima domanda: quando l'avventura finisce, come dovrebbe sentirsi ${name}?`,
  launch: (mood, name, companion, world, engine) =>
    `${mood}. Allora so esattamente come finisce. ${name} — un eroe. ${companion} — un fedele compagno. ${world}. ${engine}. Questa storia non è mai esistita prima di stanotte. Pronti?`,
  hereWeGo: "...E... si... parte.",
  q1TextOwn: "Come ti chiami?",
  q1TextStranger: "Dai un nome allo sconosciuto...",
  q3Nudge: "Qualcuno che conosci? Può essere nella storia anche lui.",
  q4Hint: "Sii breve — Bluebell funziona meglio con un'unica idea.",
  emptyError: "Dai a Bluebell qualcosa su cui lavorare!",
  generating: (heroName, world) => [
    "Bluebell sta tessendo il racconto...",
    `Alla ricerca della voce di ${heroName}...`,
    `${world} sta prendendo forma...`,
    "Quasi pronto...",
  ],
  generatingLong: "Ci siamo quasi — Bluebell sta lavorando su qualcosa di speciale...",
  apiError: "Bluebell ha perso il filo — riproviamo?",
};

const AR: BluebellCopy = {
  q1: "كل مغامرة تحتاج إلى بطل. من سيكون بطلنا الليلة؟",
  q1Confirm: (name) => `${name}! ممتاز.`,
  q2: (name) => `الآن — أين يوجد عالم ${name}؟`,
  q2Confirm: (world) => `${world}! أستطيع أن أشعر بذلك بالفعل.`,
  q3: (world, name) => `${world}! أستطيع أن أشعر بذلك بالفعل. الآن — من يرافق ${name}؟`,
  q3Confirm: (companion) => `${companion}! رائع.`,
  q4: (companion, name) => `${companion}! رائع. الآن — وهذا هو أهم سؤال على الإطلاق — ما هو الشيء الأكثر إضحاكاً أو الأكثر إخافة في عالم ${name}؟`,
  q4Reaction1: "أوه... هذا هو النوع الأكثر خطورة.",
  q4Confirm: (engine) => `${engine}... هذا صحيح تماماً.`,
  q5: (engine, name) => `${engine}... هذا رائع. السؤال الأخير: عندما تنتهي المغامرة، كيف يجب أن يشعر ${name}؟`,
  launch: (mood, name, companion, world, engine) =>
    `${mood}. إذن أنا أعرف بالضبط كيف ينتهي هذا. ${name} — بطل. ${companion} — رفيق مخلص. ${world}. ${engine}. هذه القصة لم توجد من قبل حتى الليلة. هل أنتم مستعدون؟`,
  hereWeGo: "...ها نحن... ننطلق.",
  q1TextOwn: "ما اسمك؟",
  q1TextStranger: "أعطِ الغريب اسماً...",
  q3Nudge: "شخص تعرفه؟ يمكن أن يكون في القصة أيضاً.",
  q4Hint: "اجعلها قصيرة — بلوبيل تعمل بشكل أفضل مع فكرة واحدة.",
  emptyError: "أعطِ بلوبيل شيئاً للعمل عليه!",
  generating: (heroName, world) => [
    "بلوبيل تنسج الحكاية...",
    `تبحث عن صوت ${heroName}...`,
    `${world} يتشكل...`,
    "على وشك الجاهزية...",
  ],
  generatingLong: "على وشك الانتهاء — بلوبيل تعمل على شيء مميز...",
  apiError: "بلوبيل فقدت الخيط — هل نحاول مرة أخرى؟",
};

const JA: BluebellCopy = {
  q1: "どんな冒険にもヒーローが必要です。今夜のヒーローは誰にしましょうか?",
  q1Confirm: (name) => `${name}!完璧です。`,
  q2: (name) => `さあ——${name}の世界はどこにありますか?`,
  q2Confirm: (world) => `${world}!もう感じられます。`,
  q3: (world, name) => `${world}!もう感じられます。さあ——${name}と一緒に旅するのは誰ですか?`,
  q3Confirm: (companion) => `${companion}!素晴らしい。`,
  q4: (companion, name) => `${companion}!素晴らしい。さあ——これが一番大事な質問です——${name}の世界で一番面白いこと、または一番怖いことは何ですか?`,
  q4Reaction1: "ああ…それは一番危険な種類です。",
  q4Confirm: (engine) => `${engine}…まさにその通りです。`,
  q5: (engine, name) => `${engine}…素晴らしいです。最後の質問です:冒険が終わるとき、${name}はどんな気持ちになるべきですか?`,
  launch: (mood, name, companion, world, engine) =>
    `${mood}。それなら、これがどう終わるか正確にわかります。${name}——ヒーロー。${companion}——忠実な仲間。${world}。${engine}。この物語は今夜まで一度も存在しませんでした。準備はいいですか?`,
  hereWeGo: "…さあ…行き…ましょう。",
  q1TextOwn: "お名前は?",
  q1TextStranger: "見知らぬ人に名前をつけてください…",
  q3Nudge: "知っている人ですか?その人も物語に登場できます。",
  q4Hint: "短くしてください——ブルーベルは一つのアイデアで一番うまく働きます。",
  emptyError: "ブルーベルに何か材料をあげてください!",
  generating: (heroName, world) => [
    "ブルーベルが物語を紡いでいます…",
    `${heroName}の声を見つけています…`,
    `${world}が形になっています…`,
    "もうすぐです…",
  ],
  generatingLong: "もう少しです——ブルーベルが特別な何かに取り組んでいます…",
  apiError: "ブルーベルが糸を見失いました——もう一度やってみますか?",
};

const HI: BluebellCopy = {
  q1: "हर रोमांच को एक नायक चाहिए। आज रात हमारा नायक कौन होगा?",
  q1Confirm: (name) => `${name}! एकदम सही।`,
  q2: (name) => `अब — ${name} की दुनिया कहाँ है?`,
  q2Confirm: (world) => `${world}! मुझे यह पहले से ही महसूस हो रहा है।`,
  q3: (world, name) => `${world}! मुझे यह पहले से ही महसूस हो रहा है। अब — ${name} के साथ कौन यात्रा करता है?`,
  q3Confirm: (companion) => `${companion}! शानदार।`,
  q4: (companion, name) => `${companion}! शानदार। अब — और यह सबसे महत्वपूर्ण सवाल है — ${name} की दुनिया में सबसे मज़ेदार या सबसे डरावनी चीज़ क्या है?`,
  q4Reaction1: "ओह... यह सबसे खतरनाक किस्म है।",
  q4Confirm: (engine) => `${engine}... यह बिल्कुल सही है।`,
  q5: (engine, name) => `${engine}... यह शानदार है। आखिरी सवाल: जब रोमांच खत्म हो, तो ${name} को कैसा महसूस होना चाहिए?`,
  launch: (mood, name, companion, world, engine) =>
    `${mood}। तो मुझे पता है कि यह कैसे खत्म होगा। ${name} — एक नायक। ${companion} — एक वफादार साथी। ${world}। ${engine}। यह कहानी आज रात से पहले कभी नहीं थी। तैयार हैं?`,
  hereWeGo: "...चलो... चलते... हैं।",
  q1TextOwn: "तुम्हारा नाम क्या है?",
  q1TextStranger: "अजनबी को एक नाम दो...",
  q3Nudge: "कोई जिसे तुम जानते हो? वे भी कहानी में हो सकते हैं।",
  q4Hint: "इसे छोटा रखें — ब्लूबेल एक विचार के साथ सबसे अच्छा काम करती है।",
  emptyError: "ब्लूबेल को काम करने के लिए कुछ दो!",
  generating: (heroName, world) => [
    "ब्लूबेल कहानी बुन रही है...",
    `${heroName} की आवाज़ ढूंढ रही है...`,
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
