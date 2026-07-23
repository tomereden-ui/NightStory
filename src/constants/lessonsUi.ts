// Localized display layer for the "Values" feature (LessonStep +
// LessonEditor — internal names kept for stability). The underlying
// identifier sent to the backend / stored in `lessons: string[]` and
// `stories.moral_lessons` stays the stable English canonical id below —
// only the icon/label/description shown to the user, and the UI chrome
// around it, are localized.

import type { IconName } from "@/lib/icons";

export const LESSON_IDS = [
  "Bravery", "Friendship", "Kindness", "Honesty", "Perseverance",
  "Sharing", "Patience", "Respecting differences", "Responsibility", "Gratitude",
] as const;

export type LessonId = typeof LESSON_IDS[number];
// Kept as an alias — LessonEditor/LessonStep referred to this as LessonLabel before.
export type LessonLabel = LessonId;

export interface LessonCatalogEntry { id: LessonId; icon: IconName; label: string; desc: string }

// Abstract, minimal line icons (from the shared icon registry) instead of
// emoji — emoji render inconsistently across platforms/fonts (e.g. the old
// "Respecting differences" 🌈 and "Responsibility" 🌟 could both end up
// looking like an ambiguous flower/sunburst depending on the font) and don't
// match the rest of the app's icon style.
const ICONS: Record<LessonId, IconName> = {
  "Bravery": "shield", "Friendship": "users", "Kindness": "heart", "Honesty": "star", "Perseverance": "trendingUp",
  "Sharing": "gift", "Patience": "clock", "Respecting differences": "diversity", "Responsibility": "checklist", "Gratitude": "sun",
};

const CATALOG_TEXT: Record<string, Record<LessonId, { label: string; desc: string }>> = {
  en: {
    "Bravery": { label: "Bravery", desc: "Facing fears, trying scary things" },
    "Friendship": { label: "Friendship", desc: "Sharing, including others, resolving conflict" },
    "Kindness": { label: "Kindness", desc: "Noticing when others need help" },
    "Honesty": { label: "Honesty", desc: "Telling the truth even when it's hard" },
    "Perseverance": { label: "Perseverance", desc: "Trying again after failing" },
    "Sharing": { label: "Sharing", desc: "Generosity with others" },
    "Patience": { label: "Patience", desc: "Waiting calmly" },
    "Respecting differences": { label: "Respecting differences", desc: "Appreciating diversity, not judging" },
    "Responsibility": { label: "Responsibility", desc: "Taking care of things, pets, promises" },
    "Gratitude": { label: "Gratitude", desc: "Appreciating what you have" },
  },
  he: {
    "Bravery": { label: "אומץ", desc: "להתמודד עם פחדים, לנסות דברים מפחידים" },
    "Friendship": { label: "חברות", desc: "שיתוף, הכללת אחרים, פתרון קונפליקטים" },
    "Kindness": { label: "אדיבות", desc: "לשים לב מתי אחרים צריכים עזרה" },
    "Honesty": { label: "כנות", desc: "לומר את האמת גם כשקשה" },
    "Perseverance": { label: "התמדה", desc: "לנסות שוב אחרי כישלון" },
    "Sharing": { label: "שיתוף", desc: "נדיבות כלפי אחרים" },
    "Patience": { label: "סבלנות", desc: "לחכות בשקט" },
    "Respecting differences": { label: "כיבוד שונות", desc: "להעריך גיוון, לא לשפוט" },
    "Responsibility": { label: "אחריות", desc: "לדאוג לדברים, לחיות מחמד, להבטחות" },
    "Gratitude": { label: "הכרת תודה", desc: "להעריך את מה שיש לך" },
  },
  es: {
    "Bravery": { label: "Valentía", desc: "Enfrentar miedos, intentar cosas que dan miedo" },
    "Friendship": { label: "Amistad", desc: "Compartir, incluir a otros, resolver conflictos" },
    "Kindness": { label: "Bondad", desc: "Notar cuando otros necesitan ayuda" },
    "Honesty": { label: "Honestidad", desc: "Decir la verdad incluso cuando es difícil" },
    "Perseverance": { label: "Perseverancia", desc: "Intentarlo de nuevo tras fallar" },
    "Sharing": { label: "Compartir", desc: "Generosidad con los demás" },
    "Patience": { label: "Paciencia", desc: "Esperar con calma" },
    "Respecting differences": { label: "Respetar las diferencias", desc: "Apreciar la diversidad, no juzgar" },
    "Responsibility": { label: "Responsabilidad", desc: "Cuidar cosas, mascotas, promesas" },
    "Gratitude": { label: "Gratitud", desc: "Apreciar lo que tienes" },
  },
  fr: {
    "Bravery": { label: "Courage", desc: "Affronter ses peurs, essayer des choses effrayantes" },
    "Friendship": { label: "Amitié", desc: "Partager, inclure les autres, résoudre les conflits" },
    "Kindness": { label: "Gentillesse", desc: "Remarquer quand les autres ont besoin d'aide" },
    "Honesty": { label: "Honnêteté", desc: "Dire la vérité même quand c'est difficile" },
    "Perseverance": { label: "Persévérance", desc: "Réessayer après un échec" },
    "Sharing": { label: "Partage", desc: "Générosité envers les autres" },
    "Patience": { label: "Patience", desc: "Attendre calmement" },
    "Respecting differences": { label: "Respect des différences", desc: "Apprécier la diversité, ne pas juger" },
    "Responsibility": { label: "Responsabilité", desc: "Prendre soin des choses, des animaux, des promesses" },
    "Gratitude": { label: "Gratitude", desc: "Apprécier ce que l'on a" },
  },
  de: {
    "Bravery": { label: "Mut", desc: "Ängste überwinden, gruselige Dinge ausprobieren" },
    "Friendship": { label: "Freundschaft", desc: "Teilen, andere einbeziehen, Konflikte lösen" },
    "Kindness": { label: "Freundlichkeit", desc: "Bemerken, wenn andere Hilfe brauchen" },
    "Honesty": { label: "Ehrlichkeit", desc: "Die Wahrheit sagen, auch wenn es schwerfällt" },
    "Perseverance": { label: "Durchhaltevermögen", desc: "Nach einem Fehlschlag wieder versuchen" },
    "Sharing": { label: "Teilen", desc: "Großzügigkeit gegenüber anderen" },
    "Patience": { label: "Geduld", desc: "Ruhig warten" },
    "Respecting differences": { label: "Vielfalt respektieren", desc: "Vielfalt schätzen, nicht urteilen" },
    "Responsibility": { label: "Verantwortung", desc: "Sich um Dinge, Haustiere, Versprechen kümmern" },
    "Gratitude": { label: "Dankbarkeit", desc: "Schätzen, was man hat" },
  },
  pt: {
    "Bravery": { label: "Coragem", desc: "Enfrentar medos, tentar coisas assustadoras" },
    "Friendship": { label: "Amizade", desc: "Compartilhar, incluir outros, resolver conflitos" },
    "Kindness": { label: "Bondade", desc: "Perceber quando outros precisam de ajuda" },
    "Honesty": { label: "Honestidade", desc: "Dizer a verdade mesmo quando é difícil" },
    "Perseverance": { label: "Perseverança", desc: "Tentar de novo depois de falhar" },
    "Sharing": { label: "Partilha", desc: "Generosidade com os outros" },
    "Patience": { label: "Paciência", desc: "Esperar com calma" },
    "Respecting differences": { label: "Respeitar diferenças", desc: "Apreciar a diversidade, não julgar" },
    "Responsibility": { label: "Responsabilidade", desc: "Cuidar de coisas, animais, promessas" },
    "Gratitude": { label: "Gratidão", desc: "Apreciar o que se tem" },
  },
  it: {
    "Bravery": { label: "Coraggio", desc: "Affrontare le paure, provare cose spaventose" },
    "Friendship": { label: "Amicizia", desc: "Condividere, includere gli altri, risolvere i conflitti" },
    "Kindness": { label: "Gentilezza", desc: "Accorgersi quando gli altri hanno bisogno di aiuto" },
    "Honesty": { label: "Onestà", desc: "Dire la verità anche quando è difficile" },
    "Perseverance": { label: "Perseveranza", desc: "Riprovare dopo un fallimento" },
    "Sharing": { label: "Condivisione", desc: "Generosità verso gli altri" },
    "Patience": { label: "Pazienza", desc: "Aspettare con calma" },
    "Respecting differences": { label: "Rispettare le differenze", desc: "Apprezzare la diversità, non giudicare" },
    "Responsibility": { label: "Responsabilità", desc: "Prendersi cura di cose, animali, promesse" },
    "Gratitude": { label: "Gratitudine", desc: "Apprezzare ciò che si ha" },
  },
  ar: {
    "Bravery": { label: "الشجاعة", desc: "مواجهة المخاوف، تجربة أشياء مخيفة" },
    "Friendship": { label: "الصداقة", desc: "المشاركة، إشراك الآخرين، حل النزاعات" },
    "Kindness": { label: "اللطف", desc: "ملاحظة متى يحتاج الآخرون للمساعدة" },
    "Honesty": { label: "الصدق", desc: "قول الحقيقة حتى عندما يكون ذلك صعباً" },
    "Perseverance": { label: "المثابرة", desc: "المحاولة مجدداً بعد الفشل" },
    "Sharing": { label: "المشاركة", desc: "الكرم تجاه الآخرين" },
    "Patience": { label: "الصبر", desc: "الانتظار بهدوء" },
    "Respecting differences": { label: "احترام الاختلافات", desc: "تقدير التنوع، عدم الحكم على الآخرين" },
    "Responsibility": { label: "المسؤولية", desc: "الاعتناء بالأشياء والحيوانات الأليفة والوعود" },
    "Gratitude": { label: "الامتنان", desc: "تقدير ما تملكه" },
  },
  ja: {
    "Bravery": { label: "勇気", desc: "怖れに立ち向かい、怖いことに挑戦する" },
    "Friendship": { label: "友情", desc: "分かち合い、他者を受け入れ、対立を解決する" },
    "Kindness": { label: "優しさ", desc: "他者が助けを必要としていることに気づく" },
    "Honesty": { label: "正直さ", desc: "難しくても真実を話す" },
    "Perseverance": { label: "忍耐力", desc: "失敗しても再び挑戦する" },
    "Sharing": { label: "分かち合い", desc: "他者への寛大さ" },
    "Patience": { label: "忍耐", desc: "穏やかに待つこと" },
    "Respecting differences": { label: "違いを尊重すること", desc: "多様性を尊重し、判断しないこと" },
    "Responsibility": { label: "責任感", desc: "物やペット、約束を大切にすること" },
    "Gratitude": { label: "感謝", desc: "持っているものに感謝すること" },
  },
  hi: {
    "Bravery": { label: "बहादुरी", desc: "डर का सामना करना, डरावनी चीज़ें आज़माना" },
    "Friendship": { label: "दोस्ती", desc: "साझा करना, दूसरों को शामिल करना, झगड़े सुलझाना" },
    "Kindness": { label: "दयालुता", desc: "जब दूसरों को मदद चाहिए तो ध्यान देना" },
    "Honesty": { label: "ईमानदारी", desc: "मुश्किल होने पर भी सच बोलना" },
    "Perseverance": { label: "दृढ़ता", desc: "असफल होने के बाद फिर कोशिश करना" },
    "Sharing": { label: "साझा करना", desc: "दूसरों के प्रति उदारता" },
    "Patience": { label: "धैर्य", desc: "शांति से इंतज़ार करना" },
    "Respecting differences": { label: "भिन्नताओं का सम्मान", desc: "विविधता की सराहना करना, आंकना नहीं" },
    "Responsibility": { label: "ज़िम्मेदारी", desc: "चीज़ों, पालतू जानवरों, वादों का ध्यान रखना" },
    "Gratitude": { label: "कृतज्ञता", desc: "जो आपके पास है उसकी सराहना करना" },
  },
};

export function getLessonsCatalog(language?: string): LessonCatalogEntry[] {
  const text = (language && CATALOG_TEXT[language]) || CATALOG_TEXT.en;
  return LESSON_IDS.map((id) => ({ id, icon: ICONS[id], label: text[id].label, desc: text[id].desc }));
}

export interface LessonsChrome {
  panelTitle: string;
  addLessonButton: string;
  collapsedSubtitle: string;
  analyzing: string;
  emptyNoConfirmed: string;
  emptyNoLessons: string;
  confirmedBadge: string;
  currentlyInStory: string;
  addAValue: string;
  orDescribeOwn: string;
  customPlaceholder: string;
  cancel: string;
  apply: string;
  removeAll: string;
  // LessonStep-only (initial picker before generation)
  stepBackToIdea: string;
  stepLabel: string;
  stepHeading: string;
  stepSubheading: string;
  stepWriteMyStory: string;
  stepWriteMyStoryWithCount: (n: number) => string;
  stepSkip: string;
}

const CHROME: Record<string, LessonsChrome> = {
  en: {
    panelTitle: "Values",
    addLessonButton: "+ Add value",
    collapsedSubtitle: "The values this story brings to life",
    analyzing: "Reading the story for embedded values…",
    emptyNoConfirmed: "No confirmed values yet — rewrite the story below to weave your selected value in.",
    emptyNoLessons: "No value detected yet — tap “+ Add value” to weave one into the story.",
    confirmedBadge: "Confirmed in this story",
    currentlyInStory: "Currently in this story",
    addAValue: "Add a value",
    orDescribeOwn: "Or describe your own",
    customPlaceholder: "e.g. learning to ask for help…",
    cancel: "Cancel",
    apply: "Apply",
    removeAll: "Remove all values",
    stepBackToIdea: "Back to idea",
    stepLabel: "Optional · Step 2",
    stepHeading: "Want today's story to teach something?",
    stepSubheading: "Pick one or more values — they'll be woven in naturally, never stated out loud.",
    stepWriteMyStory: "Write My Story",
    stepWriteMyStoryWithCount: (n) => `Write My Story with ${n} values`,
    stepSkip: "Skip — just tell a fun story",
  },
  he: {
    panelTitle: "ערכים",
    addLessonButton: "+ הוסף ערך",
    collapsedSubtitle: "הערכים שהסיפור הזה מביא לחיים",
    analyzing: "קוראים את הסיפור לאיתור ערכים מוטמעים…",
    emptyNoConfirmed: "עדיין אין ערכים מאושרים — שכתבו את הסיפור למטה כדי לשלב את הערך שבחרתם.",
    emptyNoLessons: "עדיין לא זוהה ערך — הקישו על “+ הוסף ערך” כדי לשלב ערך בסיפור.",
    confirmedBadge: "מאושר בסיפור זה",
    currentlyInStory: "כרגע בסיפור זה",
    addAValue: "הוספת ערך",
    orDescribeOwn: "או תארו בעצמכם",
    customPlaceholder: "לדוגמה: ללמוד לבקש עזרה…",
    cancel: "ביטול",
    apply: "החל",
    removeAll: "הסר את כל הערכים",
    stepBackToIdea: "חזרה לרעיון",
    stepLabel: "אופציונלי · שלב 2",
    stepHeading: "רוצים שהסיפור של היום ילמד משהו?",
    stepSubheading: "בחרו ערך אחד או יותר — הם ישולבו בטבעיות, בלי להיאמר במפורש.",
    stepWriteMyStory: "כתבו את הסיפור שלי",
    stepWriteMyStoryWithCount: (n) => `כתבו את הסיפור שלי עם ${n} ערכים`,
    stepSkip: "דלגו — פשוט ספרו סיפור כיפי",
  },
  es: {
    panelTitle: "Valores",
    addLessonButton: "+ Añadir valor",
    collapsedSubtitle: "Los valores que esta historia transmite",
    analyzing: "Leyendo la historia en busca de valores incorporados…",
    emptyNoConfirmed: "Aún no hay valores confirmados — reescribe la historia abajo para incorporar el valor elegido.",
    emptyNoLessons: "Aún no se detectó ningún valor — toca “+ Añadir valor” para incorporarlo a la historia.",
    confirmedBadge: "Confirmado en esta historia",
    currentlyInStory: "Actualmente en esta historia",
    addAValue: "Añadir un valor",
    orDescribeOwn: "O describe el tuyo",
    customPlaceholder: "p. ej. aprender a pedir ayuda…",
    cancel: "Cancelar",
    apply: "Aplicar",
    removeAll: "Quitar todos los valores",
    stepBackToIdea: "Volver a la idea",
    stepLabel: "Opcional · Paso 2",
    stepHeading: "¿Quieres que la historia de hoy enseñe algo?",
    stepSubheading: "Elige uno o más valores — se incorporarán naturalmente, sin decirlos explícitamente.",
    stepWriteMyStory: "Escribir mi historia",
    stepWriteMyStoryWithCount: (n) => `Escribir mi historia con ${n} valores`,
    stepSkip: "Omitir — solo cuenta una historia divertida",
  },
  fr: {
    panelTitle: "Valeurs",
    addLessonButton: "+ Ajouter une valeur",
    collapsedSubtitle: "Les valeurs que cette histoire transmet",
    analyzing: "Lecture de l'histoire à la recherche de valeurs intégrées…",
    emptyNoConfirmed: "Aucune valeur confirmée pour l'instant — réécrivez l'histoire ci-dessous pour intégrer la valeur choisie.",
    emptyNoLessons: "Aucune valeur détectée pour l'instant — appuyez sur « + Ajouter une valeur » pour en intégrer une.",
    confirmedBadge: "Confirmé dans cette histoire",
    currentlyInStory: "Actuellement dans cette histoire",
    addAValue: "Ajouter une valeur",
    orDescribeOwn: "Ou décrivez la vôtre",
    customPlaceholder: "ex. apprendre à demander de l'aide…",
    cancel: "Annuler",
    apply: "Appliquer",
    removeAll: "Supprimer toutes les valeurs",
    stepBackToIdea: "Retour à l'idée",
    stepLabel: "Facultatif · Étape 2",
    stepHeading: "Voulez-vous que l'histoire d'aujourd'hui enseigne quelque chose ?",
    stepSubheading: "Choisissez une ou plusieurs valeurs — elles seront intégrées naturellement, sans être énoncées explicitement.",
    stepWriteMyStory: "Écrire mon histoire",
    stepWriteMyStoryWithCount: (n) => `Écrire mon histoire avec ${n} valeurs`,
    stepSkip: "Passer — juste une histoire amusante",
  },
  de: {
    panelTitle: "Werte",
    addLessonButton: "+ Wert hinzufügen",
    collapsedSubtitle: "Die Werte, die diese Geschichte vermittelt",
    analyzing: "Die Geschichte wird nach eingebetteten Werten durchsucht…",
    emptyNoConfirmed: "Noch keine bestätigten Werte — schreibe die Geschichte unten um, um den gewählten Wert einzubauen.",
    emptyNoLessons: "Noch kein Wert erkannt — tippe auf „+ Wert hinzufügen“, um einen Wert einzubauen.",
    confirmedBadge: "In dieser Geschichte bestätigt",
    currentlyInStory: "Derzeit in dieser Geschichte",
    addAValue: "Wert hinzufügen",
    orDescribeOwn: "Oder beschreibe deinen eigenen",
    customPlaceholder: "z. B. lernen, um Hilfe zu bitten…",
    cancel: "Abbrechen",
    apply: "Übernehmen",
    removeAll: "Alle Werte entfernen",
    stepBackToIdea: "Zurück zur Idee",
    stepLabel: "Optional · Schritt 2",
    stepHeading: "Soll die heutige Geschichte etwas vermitteln?",
    stepSubheading: "Wähle einen oder mehrere Werte — sie werden natürlich eingewoben, nie ausdrücklich genannt.",
    stepWriteMyStory: "Meine Geschichte schreiben",
    stepWriteMyStoryWithCount: (n) => `Meine Geschichte mit ${n} Werten schreiben`,
    stepSkip: "Überspringen — einfach eine lustige Geschichte erzählen",
  },
  pt: {
    panelTitle: "Valores",
    addLessonButton: "+ Adicionar valor",
    collapsedSubtitle: "Os valores que esta história transmite",
    analyzing: "Lendo a história em busca de valores incorporados…",
    emptyNoConfirmed: "Ainda não há valores confirmados — reescreva a história abaixo para incorporar o valor escolhido.",
    emptyNoLessons: "Nenhum valor detectado ainda — toque em “+ Adicionar valor” para incorporá-lo à história.",
    confirmedBadge: "Confirmado nesta história",
    currentlyInStory: "Atualmente nesta história",
    addAValue: "Adicionar um valor",
    orDescribeOwn: "Ou descreva o seu",
    customPlaceholder: "ex. aprender a pedir ajuda…",
    cancel: "Cancelar",
    apply: "Aplicar",
    removeAll: "Remover todos os valores",
    stepBackToIdea: "Voltar à ideia",
    stepLabel: "Opcional · Etapa 2",
    stepHeading: "Quer que a história de hoje ensine algo?",
    stepSubheading: "Escolha um ou mais valores — eles serão incorporados naturalmente, nunca ditos explicitamente.",
    stepWriteMyStory: "Escrever minha história",
    stepWriteMyStoryWithCount: (n) => `Escrever minha história com ${n} valores`,
    stepSkip: "Pular — apenas conte uma história divertida",
  },
  it: {
    panelTitle: "Valori",
    addLessonButton: "+ Aggiungi valore",
    collapsedSubtitle: "I valori che questa storia trasmette",
    analyzing: "Lettura della storia alla ricerca di valori incorporati…",
    emptyNoConfirmed: "Ancora nessun valore confermato — riscrivi la storia qui sotto per incorporare il valore scelto.",
    emptyNoLessons: "Ancora nessun valore rilevato — tocca “+ Aggiungi valore” per incorporarlo nella storia.",
    confirmedBadge: "Confermato in questa storia",
    currentlyInStory: "Attualmente in questa storia",
    addAValue: "Aggiungi un valore",
    orDescribeOwn: "O descrivi il tuo",
    customPlaceholder: "es. imparare a chiedere aiuto…",
    cancel: "Annulla",
    apply: "Applica",
    removeAll: "Rimuovi tutti i valori",
    stepBackToIdea: "Torna all'idea",
    stepLabel: "Facoltativo · Passaggio 2",
    stepHeading: "Vuoi che la storia di oggi insegni qualcosa?",
    stepSubheading: "Scegli uno o più valori — verranno incorporati naturalmente, mai dichiarati esplicitamente.",
    stepWriteMyStory: "Scrivi la mia storia",
    stepWriteMyStoryWithCount: (n) => `Scrivi la mia storia con ${n} valori`,
    stepSkip: "Salta — racconta solo una storia divertente",
  },
  ar: {
    panelTitle: "القيم",
    addLessonButton: "+ إضافة قيمة",
    collapsedSubtitle: "القيم التي تجسدها هذه القصة",
    analyzing: "جارٍ قراءة القصة بحثاً عن القيم المتضمنة…",
    emptyNoConfirmed: "لا توجد قيم مؤكدة بعد — أعد كتابة القصة أدناه لدمج القيمة التي اخترتها.",
    emptyNoLessons: "لم يتم اكتشاف أي قيمة بعد — اضغط على “+ إضافة قيمة” لدمجها في القصة.",
    confirmedBadge: "مؤكد في هذه القصة",
    currentlyInStory: "حالياً في هذه القصة",
    addAValue: "إضافة قيمة",
    orDescribeOwn: "أو صف قيمتك الخاصة",
    customPlaceholder: "مثال: تعلم طلب المساعدة…",
    cancel: "إلغاء",
    apply: "تطبيق",
    removeAll: "إزالة جميع القيم",
    stepBackToIdea: "العودة إلى الفكرة",
    stepLabel: "اختياري · الخطوة 2",
    stepHeading: "هل تريد أن تعلّم قصة اليوم شيئاً ما؟",
    stepSubheading: "اختر قيمة واحدة أو أكثر — سيتم دمجها بشكل طبيعي، دون ذكرها صراحةً.",
    stepWriteMyStory: "اكتب قصتي",
    stepWriteMyStoryWithCount: (n) => `اكتب قصتي مع ${n} قيم`,
    stepSkip: "تخطّي — فقط احكِ قصة ممتعة",
  },
  ja: {
    panelTitle: "価値観",
    addLessonButton: "+ 価値観を追加",
    collapsedSubtitle: "この物語が伝える価値観",
    analyzing: "物語から埋め込まれた価値観を読み取っています…",
    emptyNoConfirmed: "まだ確認された価値観はありません — 下の物語を書き直して選んだ価値観を織り込みましょう。",
    emptyNoLessons: "まだ価値観は検出されていません — 「+ 価値観を追加」をタップして物語に織り込みましょう。",
    confirmedBadge: "この物語で確認済み",
    currentlyInStory: "現在この物語にあるもの",
    addAValue: "価値観を追加",
    orDescribeOwn: "または自分で説明する",
    customPlaceholder: "例：助けを求めることを学ぶ…",
    cancel: "キャンセル",
    apply: "適用",
    removeAll: "すべての価値観を削除",
    stepBackToIdea: "アイデアに戻る",
    stepLabel: "任意 · ステップ2",
    stepHeading: "今日の物語に何かを教えさせますか？",
    stepSubheading: "1つ以上の価値観を選んでください — 明言せずに自然に織り込まれます。",
    stepWriteMyStory: "私の物語を書く",
    stepWriteMyStoryWithCount: (n) => `${n}個の価値観で私の物語を書く`,
    stepSkip: "スキップ — ただ楽しい物語を語る",
  },
  hi: {
    panelTitle: "मूल्य",
    addLessonButton: "+ मूल्य जोड़ें",
    collapsedSubtitle: "इस कहानी में उतारे गए मूल्य",
    analyzing: "कहानी में शामिल मूल्यों को पढ़ा जा रहा है…",
    emptyNoConfirmed: "अभी तक कोई पुष्ट मूल्य नहीं — चुने गए मूल्य को शामिल करने के लिए नीचे कहानी फिर से लिखें।",
    emptyNoLessons: "अभी तक कोई मूल्य नहीं मिला — कहानी में मूल्य जोड़ने के लिए “+ मूल्य जोड़ें” पर टैप करें।",
    confirmedBadge: "इस कहानी में पुष्ट",
    currentlyInStory: "फ़िलहाल इस कहानी में",
    addAValue: "एक मूल्य जोड़ें",
    orDescribeOwn: "या अपना खुद बताएं",
    customPlaceholder: "जैसे, मदद माँगना सीखना…",
    cancel: "रद्द करें",
    apply: "लागू करें",
    removeAll: "सभी मूल्य हटाएं",
    stepBackToIdea: "विचार पर वापस जाएं",
    stepLabel: "वैकल्पिक · चरण 2",
    stepHeading: "क्या आप चाहते हैं कि आज की कहानी कुछ सिखाए?",
    stepSubheading: "एक या अधिक मूल्य चुनें — वे स्वाभाविक रूप से शामिल होंगे, कभी स्पष्ट रूप से नहीं कहे जाएंगे।",
    stepWriteMyStory: "मेरी कहानी लिखें",
    stepWriteMyStoryWithCount: (n) => `${n} मूल्यों के साथ मेरी कहानी लिखें`,
    stepSkip: "छोड़ें — बस एक मज़ेदार कहानी सुनाएं",
  },
};

export function getLessonsChrome(language?: string): LessonsChrome {
  return (language && CHROME[language]) || CHROME.en;
}
