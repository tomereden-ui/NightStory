// All Luna narrator copy lives here — nowhere else.

export interface LunaCopy {
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
  /** Narrated title on the summary/selections screen, before the launch
   *  recap script — announces the recap is about to begin. */
  summaryReady: string;
  q1TextOwn: string;
  q1TextStranger: string;
  q1TextFamilyFriend: string;
  q1TextAnimal: string;
  /** Placeholder for the free-text field shown after tapping the "+" chip
   *  in Q1's animal picker, before the AI has confirmed it's really an animal. */
  q1TextCustomAnimal: string;
  q3Nudge: string;
  q4Hint: string;
  emptyError: string;
  generating: (world: string) => string[];
  generatingLong: string;
  apiError: string;
}

const EN: LunaCopy = {
  q1: "Every adventure needs a hero. Who's ours tonight?",
  q1Confirm: "Perfect! Our hero is ready.",
  q2: "Now — in what world does our story take place?",
  q2Confirm: (world) => `${world}! I can already feel it.`,
  q3: (world) => `${world}! I can already feel it. Now — who travels alongside our hero?`,
  q3Confirm: (companion) => `${companion}! Magnificent.`,
  q4: (companion) => `${companion}! Magnificent. Now — and this is the most important question of all — what do you want to happen to our hero in our story?`,
  q4Reaction1: "Oh... that is the most dangerous kind.",
  q4Confirm: (engine) => `${engine}... that is EXACTLY right.`,
  q5: (engine) => `${engine}... that is magnificent. Last question: when the adventure ends, how should our hero feel?`,
  launch: (mood, companion, world, engine) =>
    `${mood}. Then I know exactly how this ends. Our hero. ${companion} — a loyal companion. ${world}. ${engine}. This story has never existed before tonight. Are you ready?`,
  hereWeGo: "...Here... we... go.",
  summaryReady: "We're all set! Let's create your magical story now.",
  q1TextOwn: "What's your name?",
  q1TextStranger: "Give the stranger a name...",
  q1TextFamilyFriend: "Who's coming along? Give them a name...",
  q1TextAnimal: "Give your animal hero a name...",
  q1TextCustomAnimal: "What kind of animal? (e.g. penguin, elephant...)",
  q3Nudge: "Someone you know? They can be in the story too.",
  q4Hint: "Keep it short — Luna works best with one idea.",
  emptyError: "Give Luna something to work with!",
  generating: (world) => [
    "Luna is weaving the tale...",
    "Finding our hero's voice...",
    `${world} is taking shape...`,
    "Almost ready...",
  ],
  generatingLong: "Almost there — Luna is working on something special...",
  apiError: "Luna lost the thread — shall we try again?",
};

const HE: LunaCopy = {
  q1: "כל הרפתקה צריכה גיבור. מי יהיה הגיבור שלנו הערב?",
  q1Confirm: "מושלם! הגיבור שלנו מוכן.",
  q2: "עכשיו — באיזה עולם מתרחש הסיפור שלנו?",
  q2Confirm: (world) => `${world}! אני כבר יכולה להרגיש את זה.`,
  q3: (world) => `${world}! אני כבר יכולה להרגיש את זה. עכשיו — מי מלווה את הגיבור שלנו?`,
  q3Confirm: (companion) => `${companion}! נהדר.`,
  q4: (companion) => `${companion}! נהדר. עכשיו — וזו השאלה הכי חשובה מכולן — מה תרצו שיקרה לגיבור שלנו בסיפור?`,
  q4Reaction1: "אה... זה הסוג הכי מסוכן.",
  q4Confirm: (engine) => `${engine}... זה בדיוק נכון.`,
  q5: (engine) => `${engine}... זה נהדר. שאלה אחרונה: כשההרפתקה מסתיימת, איך הגיבור שלנו אמור להרגיש?`,
  launch: (mood, companion, world, engine) =>
    `${mood}. אז אני יודעת בדיוק איך זה נגמר. הגיבור שלנו. ${companion} — בן לוויה נאמן. ${world}. ${engine}. הסיפור הזה מעולם לא היה קיים לפני הלילה. מוכנים?`,
  hereWeGo: "...ו... יוצאים... לדרך.",
  summaryReady: "הכל מוכן! עכשיו ניצור את הסיפור הקסום שלך.",
  q1TextOwn: "מה השם שלך?",
  q1TextStranger: "תן שם לזר...",
  q1TextFamilyFriend: "מי מצטרף להרפתקה? תן להם שם...",
  q1TextAnimal: "תן לגיבור החיה שלך שם...",
  q1TextCustomAnimal: "איזו חיה? (למשל פינגווין, פיל...)",
  q3Nudge: "מישהו שאתה מכיר? גם הם יכולים להיות בסיפור.",
  q4Hint: "שמרו על זה קצר — לונה עובדת הכי טוב עם רעיון אחד.",
  emptyError: "תנו ללונה משהו לעבוד איתו!",
  generating: (world) => [
    "לונה אורגת את הסיפור...",
    "מוצאת את הקול של הגיבור שלנו...",
    `${world} מקבל צורה...`,
    "כמעט מוכן...",
  ],
  generatingLong: "עוד רגע — לונה עובדת על משהו מיוחד...",
  apiError: "לונה איבדה את החוט — ננסה שוב?",
};

const ES: LunaCopy = {
  q1: "Toda aventura necesita un héroe. ¿Quién será el nuestro esta noche?",
  q1Confirm: "¡Perfecto! Nuestro héroe está listo.",
  q2: "Ahora — ¿en qué mundo transcurre nuestra historia?",
  q2Confirm: (world) => `¡${world}! Ya puedo sentirlo.`,
  q3: (world) => `¡${world}! Ya puedo sentirlo. Ahora — ¿quién viaja junto a nuestro héroe?`,
  q3Confirm: (companion) => `¡${companion}! Magnífico.`,
  q4: (companion) => `¡${companion}! Magnífico. Ahora — y esta es la pregunta más importante de todas — ¿qué quieres que le pase a nuestro héroe en nuestra historia?`,
  q4Reaction1: "Oh... ese es el tipo más peligroso.",
  q4Confirm: (engine) => `${engine}... eso es EXACTAMENTE correcto.`,
  q5: (engine) => `${engine}... eso es magnífico. Última pregunta: cuando la aventura termine, ¿cómo debería sentirse nuestro héroe?`,
  launch: (mood, companion, world, engine) =>
    `${mood}. Entonces sé exactamente cómo termina esto. Nuestro héroe. ${companion} — un compañero leal. ${world}. ${engine}. Esta historia nunca ha existido antes de esta noche. ¿Listos?`,
  hereWeGo: "...Aquí... vamos...",
  summaryReady: "¡Todo listo! Ahora vamos a crear tu historia mágica.",
  q1TextOwn: "¿Cómo te llamas?",
  q1TextStranger: "Dale un nombre al desconocido...",
  q1TextFamilyFriend: "¿Quién los acompaña? Dales un nombre...",
  q1TextAnimal: "Dale un nombre a tu héroe animal...",
  q1TextCustomAnimal: "¿Qué animal? (p. ej. pingüino, elefante...)",
  q3Nudge: "¿Alguien que conoces? También puede estar en la historia.",
  q4Hint: "Que sea breve — Luna funciona mejor con una sola idea.",
  emptyError: "¡Dale a Luna algo con qué trabajar!",
  generating: (world) => [
    "Luna está tejiendo el cuento...",
    "Encontrando la voz de nuestro héroe...",
    `${world} está tomando forma...`,
    "Casi listo...",
  ],
  generatingLong: "Ya casi — Luna está trabajando en algo especial...",
  apiError: "Luna perdió el hilo — ¿lo intentamos de nuevo?",
};

const FR: LunaCopy = {
  q1: "Chaque aventure a besoin d'un héros. Qui sera le nôtre ce soir ?",
  q1Confirm: "Parfait ! Notre héros est prêt.",
  q2: "Maintenant — dans quel monde notre histoire se déroule-t-elle ?",
  q2Confirm: (world) => `${world} ! Je le sens déjà.`,
  q3: (world) => `${world} ! Je le sens déjà. Maintenant — qui accompagne notre héros ?`,
  q3Confirm: (companion) => `${companion} ! Magnifique.`,
  q4: (companion) => `${companion} ! Magnifique. Maintenant — et c'est la question la plus importante de toutes — que veux-tu qu'il arrive à notre héros dans notre histoire ?`,
  q4Reaction1: "Oh... c'est le genre le plus dangereux.",
  q4Confirm: (engine) => `${engine}... c'est EXACTEMENT ça.`,
  q5: (engine) => `${engine}... c'est magnifique. Dernière question : quand l'aventure se termine, comment notre héros devrait-il se sentir ?`,
  launch: (mood, companion, world, engine) =>
    `${mood}. Alors je sais exactement comment cela se termine. Notre héros. ${companion} — un compagnon fidèle. ${world}. ${engine}. Cette histoire n'a jamais existé avant ce soir. Prêts ?`,
  hereWeGo: "...Et... on y... va.",
  summaryReady: "Tout est prêt ! Créons maintenant ton histoire magique.",
  q1TextOwn: "Quel est ton nom ?",
  q1TextStranger: "Donne un nom à l'inconnu...",
  q1TextFamilyFriend: "Qui les accompagne ? Donne-leur un nom...",
  q1TextAnimal: "Donne un nom à ton héros animal...",
  q1TextCustomAnimal: "Quel animal ? (ex. pingouin, éléphant...)",
  q3Nudge: "Quelqu'un que tu connais ? Il peut aussi être dans l'histoire.",
  q4Hint: "Reste bref — Luna fonctionne mieux avec une seule idée.",
  emptyError: "Donne à Luna quelque chose à utiliser !",
  generating: (world) => [
    "Luna tisse le récit...",
    "À la recherche de la voix de notre héros...",
    `${world} prend forme...`,
    "Presque prêt...",
  ],
  generatingLong: "Presque là — Luna travaille sur quelque chose de spécial...",
  apiError: "Luna a perdu le fil — on réessaie ?",
};

const DE: LunaCopy = {
  q1: "Jedes Abenteuer braucht einen Helden. Wer wird unserer heute Abend sein?",
  q1Confirm: "Perfekt! Unser Held ist bereit.",
  q2: "Jetzt — in welcher Welt spielt unsere Geschichte?",
  q2Confirm: (world) => `${world}! Das kann ich schon spüren.`,
  q3: (world) => `${world}! Das kann ich schon spüren. Jetzt — wer begleitet unseren Helden?`,
  q3Confirm: (companion) => `${companion}! Wunderbar.`,
  q4: (companion) => `${companion}! Wunderbar. Jetzt — und das ist die wichtigste Frage von allen — was soll unserem Helden in unserer Geschichte passieren?`,
  q4Reaction1: "Oh... das ist die gefährlichste Art.",
  q4Confirm: (engine) => `${engine}... das ist GENAU richtig.`,
  q5: (engine) => `${engine}... das ist wunderbar. Letzte Frage: Wenn das Abenteuer endet, wie soll sich unser Held fühlen?`,
  launch: (mood, companion, world, engine) =>
    `${mood}. Dann weiß ich genau, wie das endet. Unser Held. ${companion} — ein treuer Begleiter. ${world}. ${engine}. Diese Geschichte gab es vor heute Nacht noch nie. Bereit?`,
  hereWeGo: "...Und... los... geht's.",
  summaryReady: "Alles ist bereit! Lass uns jetzt deine zauberhafte Geschichte erschaffen.",
  q1TextOwn: "Wie heißt du?",
  q1TextStranger: "Gib dem Fremden einen Namen...",
  q1TextFamilyFriend: "Wer begleitet sie? Gib ihnen einen Namen...",
  q1TextAnimal: "Gib deinem tierischen Helden einen Namen...",
  q1TextCustomAnimal: "Welches Tier? (z. B. Pinguin, Elefant...)",
  q3Nudge: "Jemand, den du kennst? Er kann auch in der Geschichte vorkommen.",
  q4Hint: "Halte es kurz — Luna funktioniert am besten mit einer Idee.",
  emptyError: "Gib Luna etwas zum Arbeiten!",
  generating: (world) => [
    "Luna webt die Geschichte...",
    "Findet die Stimme unseres Helden...",
    `${world} nimmt Gestalt an...`,
    "Fast fertig...",
  ],
  generatingLong: "Gleich geschafft — Luna arbeitet an etwas Besonderem...",
  apiError: "Luna hat den Faden verloren — sollen wir es noch einmal versuchen?",
};

const PT: LunaCopy = {
  q1: "Toda aventura precisa de um herói. Quem será o nosso esta noite?",
  q1Confirm: "Perfeito! Nosso herói está pronto.",
  q2: "Agora — em que mundo nossa história se passa?",
  q2Confirm: (world) => `${world}! Já consigo sentir isso.`,
  q3: (world) => `${world}! Já consigo sentir isso. Agora — quem viaja ao lado do nosso herói?`,
  q3Confirm: (companion) => `${companion}! Magnífico.`,
  q4: (companion) => `${companion}! Magnífico. Agora — e esta é a pergunta mais importante de todas — o que você quer que aconteça com o nosso herói na nossa história?`,
  q4Reaction1: "Oh... esse é o tipo mais perigoso.",
  q4Confirm: (engine) => `${engine}... isso está EXATAMENTE certo.`,
  q5: (engine) => `${engine}... isso é magnífico. Última pergunta: quando a aventura terminar, como nosso herói deve se sentir?`,
  launch: (mood, companion, world, engine) =>
    `${mood}. Então eu sei exatamente como isso termina. Nosso herói. ${companion} — um companheiro leal. ${world}. ${engine}. Esta história nunca existiu antes desta noite. Prontos?`,
  hereWeGo: "...Lá... vamos... nós.",
  summaryReady: "Está tudo pronto! Vamos criar agora a sua história mágica.",
  q1TextOwn: "Qual é o seu nome?",
  q1TextStranger: "Dê um nome ao estranho...",
  q1TextFamilyFriend: "Quem vai junto? Dê um nome a eles...",
  q1TextAnimal: "Dê um nome ao seu herói animal...",
  q1TextCustomAnimal: "Que animal? (ex. pinguim, elefante...)",
  q3Nudge: "Alguém que você conhece? Também pode estar na história.",
  q4Hint: "Seja breve — Luna funciona melhor com uma ideia.",
  emptyError: "Dê à Luna algo para trabalhar!",
  generating: (world) => [
    "Luna está tecendo a história...",
    "Encontrando a voz do nosso herói...",
    `${world} está tomando forma...`,
    "Quase pronto...",
  ],
  generatingLong: "Quase lá — Luna está trabalhando em algo especial...",
  apiError: "Luna perdeu o fio — vamos tentar de novo?",
};

const IT: LunaCopy = {
  q1: "Ogni avventura ha bisogno di un eroe. Chi sarà il nostro stasera?",
  q1Confirm: "Perfetto! Il nostro eroe è pronto.",
  q2: "Ora — in quale mondo si svolge la nostra storia?",
  q2Confirm: (world) => `${world}! Riesco già a sentirlo.`,
  q3: (world) => `${world}! Riesco già a sentirlo. Ora — chi viaggia accanto al nostro eroe?`,
  q3Confirm: (companion) => `${companion}! Magnifico.`,
  q4: (companion) => `${companion}! Magnifico. Ora — ed è la domanda più importante di tutte — cosa vuoi che succeda al nostro eroe nella nostra storia?`,
  q4Reaction1: "Oh... quello è il tipo più pericoloso.",
  q4Confirm: (engine) => `${engine}... è ESATTAMENTE giusto.`,
  q5: (engine) => `${engine}... è magnifico. Ultima domanda: quando l'avventura finisce, come dovrebbe sentirsi il nostro eroe?`,
  launch: (mood, companion, world, engine) =>
    `${mood}. Allora so esattamente come finisce. Il nostro eroe. ${companion} — un fedele compagno. ${world}. ${engine}. Questa storia non è mai esistita prima di stanotte. Pronti?`,
  hereWeGo: "...E... si... parte.",
  summaryReady: "Tutto pronto! Creiamo ora la tua storia magica.",
  q1TextOwn: "Come ti chiami?",
  q1TextStranger: "Dai un nome allo sconosciuto...",
  q1TextFamilyFriend: "Chi li accompagna? Dagli un nome...",
  q1TextAnimal: "Dai un nome al tuo eroe animale...",
  q1TextCustomAnimal: "Che animale? (es. pinguino, elefante...)",
  q3Nudge: "Qualcuno che conosci? Può essere nella storia anche lui.",
  q4Hint: "Sii breve — Luna funziona meglio con un'unica idea.",
  emptyError: "Dai a Luna qualcosa su cui lavorare!",
  generating: (world) => [
    "Luna sta tessendo il racconto...",
    "Alla ricerca della voce del nostro eroe...",
    `${world} sta prendendo forma...`,
    "Quasi pronto...",
  ],
  generatingLong: "Ci siamo quasi — Luna sta lavorando su qualcosa di speciale...",
  apiError: "Luna ha perso il filo — riproviamo?",
};

const AR: LunaCopy = {
  q1: "كل مغامرة تحتاج إلى بطل. من سيكون بطلنا الليلة؟",
  q1Confirm: "ممتاز! بطلنا جاهز.",
  q2: "الآن — في أي عالم تدور أحداث قصتنا؟",
  q2Confirm: (world) => `${world}! أستطيع أن أشعر بذلك بالفعل.`,
  q3: (world) => `${world}! أستطيع أن أشعر بذلك بالفعل. الآن — من يرافق بطلنا؟`,
  q3Confirm: (companion) => `${companion}! رائع.`,
  q4: (companion) => `${companion}! رائع. الآن — وهذا هو أهم سؤال على الإطلاق — ماذا تريد أن يحدث لبطلنا في قصتنا؟`,
  q4Reaction1: "أوه... هذا هو النوع الأكثر خطورة.",
  q4Confirm: (engine) => `${engine}... هذا صحيح تماماً.`,
  q5: (engine) => `${engine}... هذا رائع. السؤال الأخير: عندما تنتهي المغامرة، كيف يجب أن يشعر بطلنا؟`,
  launch: (mood, companion, world, engine) =>
    `${mood}. إذن أنا أعرف بالضبط كيف ينتهي هذا. بطلنا. ${companion} — رفيق مخلص. ${world}. ${engine}. هذه القصة لم توجد من قبل حتى الليلة. هل أنتم مستعدون؟`,
  hereWeGo: "...ها نحن... ننطلق.",
  summaryReady: "كل شيء جاهز! لنصنع الآن قصتك السحرية.",
  q1TextOwn: "ما اسمك؟",
  q1TextStranger: "أعطِ الغريب اسماً...",
  q1TextFamilyFriend: "من سينضم إليهم؟ أعطهم اسماً...",
  q1TextAnimal: "أعطِ بطلك الحيواني اسماً...",
  q1TextCustomAnimal: "أي حيوان؟ (مثل بطريق، فيل...)",
  q3Nudge: "شخص تعرفه؟ يمكن أن يكون في القصة أيضاً.",
  q4Hint: "اجعلها قصيرة — لونا تعمل بشكل أفضل مع فكرة واحدة.",
  emptyError: "أعطِ لونا شيئاً للعمل عليه!",
  generating: (world) => [
    "لونا تنسج الحكاية...",
    "تبحث عن صوت بطلنا...",
    `${world} يتشكل...`,
    "على وشك الجاهزية...",
  ],
  generatingLong: "على وشك الانتهاء — لونا تعمل على شيء مميز...",
  apiError: "لونا فقدت الخيط — هل نحاول مرة أخرى؟",
};

const JA: LunaCopy = {
  q1: "どんな冒険にもヒーローが必要です。今夜のヒーローは誰にしましょうか?",
  q1Confirm: "完璧です!私たちのヒーローの準備ができました。",
  q2: "さあ——私たちの物語はどんな世界で展開しますか?",
  q2Confirm: (world) => `${world}!もう感じられます。`,
  q3: (world) => `${world}!もう感じられます。さあ——私たちのヒーローと一緒に旅するのは誰ですか?`,
  q3Confirm: (companion) => `${companion}!素晴らしい。`,
  q4: (companion) => `${companion}!素晴らしい。さあ——これが一番大事な質問です——私たちのヒーローに、物語の中で何が起きてほしいですか?`,
  q4Reaction1: "ああ…それは一番危険な種類です。",
  q4Confirm: (engine) => `${engine}…まさにその通りです。`,
  q5: (engine) => `${engine}…素晴らしいです。最後の質問です:冒険が終わるとき、私たちのヒーローはどんな気持ちになるべきですか?`,
  launch: (mood, companion, world, engine) =>
    `${mood}。それなら、これがどう終わるか正確にわかります。私たちのヒーロー。${companion}——忠実な仲間。${world}。${engine}。この物語は今夜まで一度も存在しませんでした。準備はいいですか?`,
  hereWeGo: "…さあ…行き…ましょう。",
  summaryReady: "準備万端です!さあ、あなたの魔法の物語を作りましょう。",
  q1TextOwn: "お名前は?",
  q1TextStranger: "見知らぬ人に名前をつけてください…",
  q1TextFamilyFriend: "誰が一緒に行きますか?名前をつけてください…",
  q1TextAnimal: "動物のヒーローに名前をつけてください…",
  q1TextCustomAnimal: "どんな動物?(例:ペンギン、ゾウ…)",
  q3Nudge: "知っている人ですか?その人も物語に登場できます。",
  q4Hint: "短くしてください——ルナは一つのアイデアで一番うまく働きます。",
  emptyError: "ルナに何か材料をあげてください!",
  generating: (world) => [
    "ルナが物語を紡いでいます…",
    "私たちのヒーローの声を見つけています…",
    `${world}が形になっています…`,
    "もうすぐです…",
  ],
  generatingLong: "もう少しです——ルナが特別な何かに取り組んでいます…",
  apiError: "ルナが糸を見失いました——もう一度やってみますか?",
};

const HI: LunaCopy = {
  q1: "हर रोमांच को एक नायक चाहिए। आज रात हमारा नायक कौन होगा?",
  q1Confirm: "एकदम सही! हमारा नायक तैयार है।",
  q2: "अब — हमारी कहानी किस दुनिया में घटित होती है?",
  q2Confirm: (world) => `${world}! मुझे यह पहले से ही महसूस हो रहा है।`,
  q3: (world) => `${world}! मुझे यह पहले से ही महसूस हो रहा है। अब — हमारे नायक के साथ कौन यात्रा करता है?`,
  q3Confirm: (companion) => `${companion}! शानदार।`,
  q4: (companion) => `${companion}! शानदार। अब — और यह सबसे महत्वपूर्ण सवाल है — आप चाहते हैं कि हमारी कहानी में हमारे नायक के साथ क्या हो?`,
  q4Reaction1: "ओह... यह सबसे खतरनाक किस्म है।",
  q4Confirm: (engine) => `${engine}... यह बिल्कुल सही है।`,
  q5: (engine) => `${engine}... यह शानदार है। आखिरी सवाल: जब रोमांच खत्म हो, तो हमारे नायक को कैसा महसूस होना चाहिए?`,
  launch: (mood, companion, world, engine) =>
    `${mood}। तो मुझे पता है कि यह कैसे खत्म होगा। हमारा नायक। ${companion} — एक वफादार साथी। ${world}। ${engine}। यह कहानी आज रात से पहले कभी नहीं थी। तैयार हैं?`,
  hereWeGo: "...चलो... चलते... हैं।",
  summaryReady: "सब कुछ तैयार है! अब चलो तुम्हारी जादुई कहानी बनाते हैं।",
  q1TextOwn: "तुम्हारा नाम क्या है?",
  q1TextStranger: "अजनबी को एक नाम दो...",
  q1TextFamilyFriend: "साथ में कौन आ रहा है? उन्हें एक नाम दो...",
  q1TextAnimal: "अपने जानवर हीरो को एक नाम दो...",
  q1TextCustomAnimal: "कौन सा जानवर? (जैसे पेंगुइन, हाथी...)",
  q3Nudge: "कोई जिसे तुम जानते हो? वे भी कहानी में हो सकते हैं।",
  q4Hint: "इसे छोटा रखें — लूना एक विचार के साथ सबसे अच्छा काम करती है।",
  emptyError: "लूना को काम करने के लिए कुछ दो!",
  generating: (world) => [
    "लूना कहानी बुन रही है...",
    "हमारे नायक की आवाज़ ढूंढ रही है...",
    `${world} आकार ले रहा है...`,
    "लगभग तैयार...",
  ],
  generatingLong: "लगभग हो गया — लूना किसी खास चीज़ पर काम कर रही है...",
  apiError: "लूना ने धागा खो दिया — फिर से कोशिश करें?",
};

const LUNA_BY_LANG: Record<string, LunaCopy> = { en: EN, he: HE, es: ES, fr: FR, de: DE, pt: PT, it: IT, ar: AR, ja: JA, hi: HI };

/** Localized Luna narrator copy for the given language, falling back to English. */
export function getLuna(language?: string): LunaCopy {
  return (language && LUNA_BY_LANG[language]) || EN;
}

// Kept for any other importers expecting the flat English object.
export const LUNA = EN;

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
