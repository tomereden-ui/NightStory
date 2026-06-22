import { NextRequest, NextResponse } from "next/server";
import { supabase, ensureBuckets } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const BLUEBELL_VOICE = "Kore"; // soft & gentle feminine — suits a fairy narrator

const LANG_NAMES: Record<string, string> = {
  en: "English", he: "Hebrew", ar: "Arabic", fr: "French", es: "Spanish",
  de: "German", it: "Italian", pt: "Portuguese", zh: "Chinese",
  ja: "Japanese",
};

// Generic-placeholder scripts (no hero name) per language so audio can be
// cached once and reused across all sessions for that language.
const BLUEBELL_SCRIPTS_BY_LANG: Record<string, Record<string, string>> = {
  en: {
    q1: "Every adventure needs a hero... Who's ours tonight?",
    q2: "Now... where does our hero's world exist?",
    q3: "I can already feel it! Now — who travels alongside our hero?",
    q4: "Magnificent! Now — and this is the most important question of all — what is the funniest, or the scariest thing in our hero's world?",
    q5: "That is magnificent... Last question — when the adventure ends, how should our hero feel?",
  },
  he: {
    q1: "כל הרפתקה צריכה גיבור... מי שלנו הלילה?",
    q2: "עכשיו... היכן קיים עולמו של הגיבור שלנו?",
    q3: "אני כבר מרגישה את זה! עכשיו — מי מלווה את הגיבור שלנו?",
    q4: "נהדר! עכשיו — וזו השאלה הכי חשובה מכל — מה הדבר הכי מצחיק, או הכי מפחיד בעולמו של הגיבור שלנו?",
    q5: "זה נהדר... שאלה אחרונה — כשההרפתקה נגמרת, איך הגיבור שלנו צריך להרגיש?",
  },
  es: {
    q1: "Toda aventura necesita un héroe... ¿Quién es el nuestro esta noche?",
    q2: "Ahora... ¿dónde existe el mundo de nuestro héroe?",
    q3: "¡Ya puedo sentirlo! Ahora — ¿quién viaja junto a nuestro héroe?",
    q4: "¡Magnífico! Ahora — y esta es la pregunta más importante de todas — ¿qué es lo más divertido o lo más aterrador en el mundo de nuestro héroe?",
    q5: "Eso es magnífico... Última pregunta — cuando la aventura termine, ¿cómo debería sentirse nuestro héroe?",
  },
  fr: {
    q1: "Chaque aventure a besoin d'un héros... Qui est le nôtre ce soir?",
    q2: "Maintenant... où existe le monde de notre héros?",
    q3: "Je le sens déjà! Maintenant — qui voyage aux côtés de notre héros?",
    q4: "Magnifique! Maintenant — et c'est la question la plus importante de toutes — quelle est la chose la plus drôle ou la plus effrayante dans le monde de notre héros?",
    q5: "C'est magnifique... Dernière question — quand l'aventure se termine, comment notre héros devrait-il se sentir?",
  },
  de: {
    q1: "Jedes Abenteuer braucht einen Helden... Wer ist unser Held heute Nacht?",
    q2: "Nun... wo existiert die Welt unseres Helden?",
    q3: "Ich kann es schon spüren! Nun — wer reist an der Seite unseres Helden?",
    q4: "Wundervoll! Nun — und das ist die wichtigste Frage von allen — was ist das Lustigste oder das Gruseligste in der Welt unseres Helden?",
    q5: "Das ist wundervoll... Letzte Frage — wenn das Abenteuer endet, wie sollte sich unser Held fühlen?",
  },
  pt: {
    q1: "Toda aventura precisa de um herói... Quem é o nosso esta noite?",
    q2: "Agora... onde existe o mundo do nosso herói?",
    q3: "Já posso sentir! Agora — quem viaja ao lado do nosso herói?",
    q4: "Magnífico! Agora — e esta é a pergunta mais importante de todas — qual é a coisa mais engraçada ou mais assustadora no mundo do nosso herói?",
    q5: "Isso é magnífico... Última pergunta — quando a aventura terminar, como nosso herói deve se sentir?",
  },
  ar: {
    q1: "كل مغامرة تحتاج إلى بطل... من هو بطلنا الليلة؟",
    q2: "الآن... أين يوجد عالم بطلنا؟",
    q3: "أستطيع أن أشعر بذلك بالفعل! الآن — من يسافر إلى جانب بطلنا؟",
    q4: "رائع! الآن — وهذا هو السؤال الأهم من بين جميع الأسئلة — ما هو أكثر شيء مضحك أو مخيف في عالم بطلنا؟",
    q5: "هذا رائع... السؤال الأخير — عندما تنتهي المغامرة، كيف يجب أن يشعر بطلنا؟",
  },
  zh: {
    q1: "每个冒险都需要一个英雄... 今晚我们的英雄是谁？",
    q2: "现在... 我们的英雄的世界存在于哪里？",
    q3: "我已经感受到了！现在 — 谁与我们的英雄同行？",
    q4: "太棒了！现在 — 这是所有问题中最重要的 — 我们英雄的世界里什么最有趣，或者最可怕？",
    q5: "太精彩了... 最后一个问题 — 当冒险结束时，我们的英雄应该有什么感受？",
  },
  ja: {
    q1: "すべての冒険には英雄が必要です... 今夜の私たちの英雄は誰でしょう？",
    q2: "さて... 私たちの英雄の世界はどこにあるのでしょう？",
    q3: "もうわかります！さて — 私たちの英雄と一緒に旅するのは誰でしょう？",
    q4: "素晴らしい！さて — そしてこれが一番大切な質問です — 私たちの英雄の世界で一番おかしいこと、または一番怖いことは何でしょう？",
    q5: "それは素晴らしい... 最後の質問 — 冒険が終わったとき、私たちの英雄はどう感じるべきでしょう？",
  },
  it: {
    q1: "Ogni avventura ha bisogno di un eroe... Chi è il nostro stanotte?",
    q2: "Ora... dove esiste il mondo del nostro eroe?",
    q3: "Lo sento già! Ora — chi viaggia accanto al nostro eroe?",
    q4: "Magnifico! Ora — e questa è la domanda più importante di tutte — qual è la cosa più divertente o più spaventosa nel mondo del nostro eroe?",
    q5: "È magnifico... Ultima domanda — quando l'avventura finisce, come dovrebbe sentirsi il nostro eroe?",
  },
};

const QUESTION_KEYS = ["q1", "q2", "q3", "q4", "q5"];
const FOLDER = "bluebell-questions";

function resolveScripts(lang: string): Record<string, string> {
  return BLUEBELL_SCRIPTS_BY_LANG[lang] ?? BLUEBELL_SCRIPTS_BY_LANG.en;
}

function storageKey(lang: string, questionKey: string): string {
  return `${FOLDER}/${lang}/${questionKey}.wav`;
}

function pcmToWav(pcmBase64: string): Buffer {
  const pcm = Buffer.from(pcmBase64, "base64");
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataLen = pcm.length;
  const wav = Buffer.alloc(44 + dataLen);
  let o = 0;
  wav.write("RIFF", o); o += 4;
  wav.writeUInt32LE(36 + dataLen, o); o += 4;
  wav.write("WAVE", o); o += 4;
  wav.write("fmt ", o); o += 4;
  wav.writeUInt32LE(16, o); o += 4;
  wav.writeUInt16LE(1, o); o += 2;
  wav.writeUInt16LE(numChannels, o); o += 2;
  wav.writeUInt32LE(sampleRate, o); o += 4;
  wav.writeUInt32LE(byteRate, o); o += 4;
  wav.writeUInt16LE(blockAlign, o); o += 2;
  wav.writeUInt16LE(bitsPerSample, o); o += 2;
  wav.write("data", o); o += 4;
  wav.writeUInt32LE(dataLen, o); o += 4;
  pcm.copy(wav, o);
  return wav;
}

async function generateTTS(apiKey: string, text: string, lang: string): Promise<Buffer> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
  const langName = LANG_NAMES[lang] ?? lang;
  const systemInstruction = lang !== "en"
    ? { parts: [{ text: `Speak in ${langName}.` }] }
    : undefined;
  const basePayload = {
    contents: [{ role: "user", parts: [{ text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: BLUEBELL_VOICE } } },
    },
  };
  const body = systemInstruction ? { systemInstruction, ...basePayload } : basePayload;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if ((res.status === 500 || res.status === 503) && attempt < 3) {
        await new Promise((r) => setTimeout(r, attempt * 1000));
        continue;
      }
      if (!res.ok) throw new Error(`Gemini TTS ${res.status}`);
      const json = await res.json();
      const inlineData = json.candidates?.[0]?.content?.parts?.[0]?.inlineData as { mimeType: string; data: string } | undefined;
      if (!inlineData?.data) throw new Error("No audio in Gemini response");
      const { mimeType, data } = inlineData;
      return mimeType.includes("L16") || mimeType.includes("pcm") ? pcmToWav(data) : Buffer.from(data, "base64");
    } catch (err) {
      clearTimeout(timer);
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
  throw new Error("TTS failed after 3 attempts");
}

// GET ?lang=he — returns existing audio URLs + list of missing question keys for that language
export async function GET(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get("lang") ?? "en";
  await ensureBuckets();
  const { data: files } = await supabase.storage.from("audio").list(`${FOLDER}/${lang}`);
  const existingNames = new Set((files ?? []).map((f) => f.name));

  const existingAudioUrls: Record<string, string> = {};
  const missing: string[] = [];

  for (const key of QUESTION_KEYS) {
    const fileName = `${key}.wav`;
    if (existingNames.has(fileName)) {
      existingAudioUrls[key] = supabase.storage.from("audio").getPublicUrl(storageKey(lang, key)).data.publicUrl;
    } else {
      missing.push(key);
    }
  }

  return NextResponse.json({ missing, existingAudioUrls });
}

// POST ?lang=he&key=q1 — generate TTS for one question in the given language and cache it
export async function POST(req: NextRequest) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

  const lang = req.nextUrl.searchParams.get("lang") ?? "en";
  const key = req.nextUrl.searchParams.get("key");
  const scripts = resolveScripts(lang);

  if (!key || !scripts[key]) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  await ensureBuckets();

  try {
    const wavBuf = await generateTTS(geminiKey, scripts[key], lang);
    const { error } = await supabase.storage
      .from("audio")
      .upload(storageKey(lang, key), wavBuf, { contentType: "audio/wav", upsert: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const url = supabase.storage.from("audio").getPublicUrl(storageKey(lang, key)).data.publicUrl;
    return NextResponse.json({ ok: true, key, url });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
