"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { PublicStoryData } from "@/app/api/story/[id]/route";
import { getDir } from "@/lib/i18n";
import type { Language } from "@/types";

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// The visitor opening this link has no account and no language
// preference we can read — the story's own `language` (set when the
// family created it) is the strongest signal for who's on the other
// end, so the whole page (not just the story content) follows it.
type ShareLangKey =
  | "madeWithLoveFor" | "messageLabel" | "loading" | "notFoundTitle" | "goToApp"
  | "tagline" | "badgeScreenFree" | "badgePersonalised" | "badgeCinematic"
  | "ctaCreate" | "freeNoAccount";

const SHARE_LABELS: Record<string, Record<ShareLangKey, string>> = {
  en: {
    madeWithLoveFor: "Made with love for", messageLabel: "Message",
    loading: "Loading story…", notFoundTitle: "Story not found.", goToApp: "Go to NightStory",
    tagline: "Immersive screen-free audio adventures, from reimagined classic tales to stories where your child is the hero.",
    badgeScreenFree: "Screen free", badgePersonalised: "Personalised", badgeCinematic: "Cinematic experience",
    ctaCreate: "Create a story for your child", freeNoAccount: "Free to try · No account needed",
  },
  he: {
    madeWithLoveFor: "נוצר באהבה עבור", messageLabel: "הודעה",
    loading: "טוען סיפור…", notFoundTitle: "הסיפור לא נמצא.", goToApp: "מעבר ל-NightStory",
    tagline: "הרפתקאות שמע סוחפות ללא מסך, מסיפורי קלאסיקה מחודשים ועד סיפורים שבהם הילד שלכם הוא הגיבור.",
    badgeScreenFree: "ללא מסך", badgePersonalised: "מותאם אישית", badgeCinematic: "חוויה קולנועית",
    ctaCreate: "צרו סיפור לילד שלכם", freeNoAccount: "חינם לנסות · לא נדרש חשבון",
  },
  es: {
    madeWithLoveFor: "Hecho con amor para", messageLabel: "Mensaje",
    loading: "Cargando historia…", notFoundTitle: "Historia no encontrada.", goToApp: "Ir a NightStory",
    tagline: "Aventuras de audio inmersivas y sin pantallas, desde cuentos clásicos reinventados hasta historias donde tu hijo es el héroe.",
    badgeScreenFree: "Sin pantallas", badgePersonalised: "Personalizado", badgeCinematic: "Experiencia cinematográfica",
    ctaCreate: "Crea una historia para tu hijo", freeNoAccount: "Gratis para probar · Sin necesidad de cuenta",
  },
  fr: {
    madeWithLoveFor: "Fait avec amour pour", messageLabel: "Message",
    loading: "Chargement de l'histoire…", notFoundTitle: "Histoire introuvable.", goToApp: "Aller sur NightStory",
    tagline: "Des aventures audio immersives et sans écran, des contes classiques réinventés aux histoires où votre enfant est le héros.",
    badgeScreenFree: "Sans écran", badgePersonalised: "Personnalisé", badgeCinematic: "Expérience cinématographique",
    ctaCreate: "Créez une histoire pour votre enfant", freeNoAccount: "Gratuit à essayer · Aucun compte requis",
  },
  de: {
    madeWithLoveFor: "Mit Liebe gemacht für", messageLabel: "Nachricht",
    loading: "Geschichte wird geladen…", notFoundTitle: "Geschichte nicht gefunden.", goToApp: "Zu NightStory",
    tagline: "Immersive bildschirmfreie Hörabenteuer – von neu erzählten Klassikern bis zu Geschichten, in denen Ihr Kind der Held ist.",
    badgeScreenFree: "Bildschirmfrei", badgePersonalised: "Personalisiert", badgeCinematic: "Kinoreifes Erlebnis",
    ctaCreate: "Erstelle eine Geschichte für dein Kind", freeNoAccount: "Kostenlos testen · Kein Konto nötig",
  },
  pt: {
    madeWithLoveFor: "Feito com carinho para", messageLabel: "Mensagem",
    loading: "Carregando história…", notFoundTitle: "História não encontrada.", goToApp: "Ir para o NightStory",
    tagline: "Aventuras sonoras imersivas e sem telas, de contos clássicos reinventados a histórias em que seu filho é o herói.",
    badgeScreenFree: "Sem telas", badgePersonalised: "Personalizado", badgeCinematic: "Experiência cinematográfica",
    ctaCreate: "Crie uma história para seu filho", freeNoAccount: "Grátis para experimentar · Sem necessidade de conta",
  },
  ar: {
    madeWithLoveFor: "صُنعت بحب من أجل", messageLabel: "رسالة",
    loading: "جارٍ تحميل القصة…", notFoundTitle: "القصة غير موجودة.", goToApp: "الذهاب إلى NightStory",
    tagline: "مغامرات صوتية غامرة بلا شاشات، من حكايات كلاسيكية بحلة جديدة إلى قصص يكون فيها طفلك البطل.",
    badgeScreenFree: "بلا شاشات", badgePersonalised: "مخصصة", badgeCinematic: "تجربة سينمائية",
    ctaCreate: "أنشئ قصة لطفلك", freeNoAccount: "مجاني للتجربة · لا حاجة لحساب",
  },
  ja: {
    madeWithLoveFor: "心を込めて贈ります", messageLabel: "メッセージ",
    loading: "物語を読み込み中…", notFoundTitle: "物語が見つかりません。", goToApp: "NightStoryへ",
    tagline: "画面を使わない没入型オーディオ体験。名作の新しい語り直しから、お子様が主人公になる物語まで。",
    badgeScreenFree: "画面なし", badgePersonalised: "パーソナライズ", badgeCinematic: "映画のような体験",
    ctaCreate: "お子様のための物語を作る", freeNoAccount: "無料でお試し · アカウント不要",
  },
  it: {
    madeWithLoveFor: "Fatto con amore per", messageLabel: "Messaggio",
    loading: "Caricamento della storia…", notFoundTitle: "Storia non trovata.", goToApp: "Vai a NightStory",
    tagline: "Avventure audio coinvolgenti e senza schermo, dalle fiabe classiche reinventate alle storie in cui tuo figlio è l'eroe.",
    badgeScreenFree: "Senza schermo", badgePersonalised: "Personalizzata", badgeCinematic: "Esperienza cinematografica",
    ctaCreate: "Crea una storia per tuo figlio", freeNoAccount: "Gratis da provare · Nessun account necessario",
  },
  hi: {
    madeWithLoveFor: "प्यार से बनाई गई", messageLabel: "संदेश",
    loading: "कहानी लोड हो रही है…", notFoundTitle: "कहानी नहीं मिली।", goToApp: "NightStory पर जाएं",
    tagline: "स्क्रीन-मुक्त इमर्सिव ऑडियो रोमांच — फिर से रचे गए क्लासिक किस्सों से लेकर ऐसी कहानियों तक जिनमें आपका बच्चा ही हीरो है।",
    badgeScreenFree: "स्क्रीन-मुक्त", badgePersonalised: "व्यक्तिगत", badgeCinematic: "सिनेमाई अनुभव",
    ctaCreate: "अपने बच्चे के लिए एक कहानी बनाएं", freeNoAccount: "मुफ़्त आज़माएं · खाते की ज़रूरत नहीं",
  },
};

function shareLabels(language: string): Record<ShareLangKey, string> {
  return SHARE_LABELS[language] ?? SHARE_LABELS.en;
}

function StarField() {
  const stars = Array.from({ length: 80 }, (_, i) => ({
    x: (i * 137.5) % 100,
    y: (i * 79.3) % 100,
    r: 0.4 + (i % 4) * 0.35,
    op: 0.15 + (i % 6) * 0.1,
  }));
  return (
    <svg className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
      {stars.map((s, i) => (
        <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="white" opacity={s.op} />
      ))}
    </svg>
  );
}

function ChildBubble({ child, large }: { child: { name: string; avatarEmoji: string }; large?: boolean }) {
  const isUrl = child.avatarEmoji.startsWith("http");
  const size = large ? 96 : 80;
  const innerPad = large ? 3 : 2.5;
  const fontSize = large ? 48 : 40;
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
        style={{
          width: size, height: size,
          background: "linear-gradient(135deg,#4fc3f7,#f59e0b,#a78bfa)",
          padding: innerPad,
          boxShadow: `0 0 32px rgba(79,195,247,0.5), 0 0 64px rgba(79,195,247,0.2), 0 0 96px rgba(167,139,250,0.15)`,
        }}
      >
        <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
          style={{ background: "#0a1628" }}>
          {isUrl
            ? <img src={child.avatarEmoji} alt={child.name} className="w-full h-full object-cover" />
            : <span style={{ fontSize, lineHeight: 1 }}>{child.avatarEmoji}</span>
          }
        </div>
      </div>
      <span
        className="font-bold tracking-wide"
        style={{
          fontSize: large ? "var(--fs-title)" : "var(--fs-subtitle)",
          background: "linear-gradient(135deg,#fff 0%,#b3e5fc 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        {child.name}
      </span>
    </div>
  );
}

function PromoBanner({ language }: { language: string }) {
  const sl = shareLabels(language);
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ maxWidth: 420, borderRadius: 24, boxShadow: "0 8px 40px rgba(0,0,0,0.55)" }}
    >
      {/* Image section — fixed height, top-anchored so the artwork's own
          baked-in headline ("Stories come to life...") stays fully in
          frame instead of being cropped by object-cover. Badges live in
          the solid section below instead of overlaid on the art, so
          they never compete with or hide the headline text. */}
      <div className="relative" style={{ height: 210 }}>
        {/* Same splash artwork used on the login/onboarding screens, so a
            friend clicking a shared story sees a consistent first impression
            of the app before they've ever opened it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/splash-family.png"
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 0%" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, transparent 55%, #0a0d1f 100%)" }}
        />
      </div>

      <div className="relative px-6 pt-5 pb-6" style={{ background: "#0a0d1f" }}>
        <div className="flex items-center gap-2 mb-2">
          <span style={{ fontSize: 22 }}>🌙</span>
          <p className="font-bold" style={{ color: "#fff", fontSize: "var(--fs-subtitle)" }}>NightStory</p>
        </div>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "var(--fs-body)", lineHeight: 1.5, marginBottom: 16 }}>
          {sl.tagline}
        </p>
        <div className="flex flex-wrap gap-2 mb-5">
          {[`📵 ${sl.badgeScreenFree}`, `👧 ${sl.badgePersonalised}`, `🎬 ${sl.badgeCinematic}`].map((f) => (
            <span key={f} style={{ fontSize: "var(--fs-label)", color: "rgba(255,255,255,0.65)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 100, padding: "4px 10px" }}>{f}</span>
          ))}
        </div>
        <a
          href="/"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            width: "100%", padding: "14px 20px", borderRadius: 16,
            background: "linear-gradient(135deg, #4fc3f7, #a78bfa)",
            color: "#fff", fontWeight: 700, fontSize: "var(--fs-body)",
            textDecoration: "none",
            boxShadow: "0 4px 24px rgba(79,195,247,0.4)",
          }}
        >
          <span>🌙</span>
          <span>{sl.ctaCreate}</span>
          <span style={{ opacity: 0.8 }}>→</span>
        </a>
        <p className="text-center mt-3" style={{ color: "rgba(255,255,255,0.4)", fontSize: "var(--fs-label)" }}>
          {sl.freeNoAccount}
        </p>
      </div>
    </div>
  );
}

export default function SharePageClient({ storyId }: { storyId: string }) {
  const [story, setStory]     = useState<PublicStoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [coverError, setCoverError] = useState(false);

  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying]         = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]       = useState(0);

  useEffect(() => {
    fetch(`/api/story/${storyId}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => setStory(d as PublicStoryData))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [storyId]);

  const handlePlayPause = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.pause();
    else a.play().catch(() => {});
  }, [playing]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Number(e.target.value);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#040612" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "#4fc3f7 transparent transparent transparent" }} />
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "var(--fs-body)" }}>Loading story…</p>
        </div>
      </div>
    );
  }

  if (notFound || !story) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-8 text-center" style={{ background: "#040612" }}>
        <span style={{ fontSize: 64 }}>🌙</span>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "var(--fs-body)" }}>Story not found.</p>
        <a href="/" style={{ color: "#4fc3f7", fontSize: "var(--fs-body)" }}>Go to NightStory →</a>
      </div>
    );
  }

  const childNames = story.children.map((c) => c.name);
  const forLabel   = childNames.length === 0 ? null
    : childNames.length === 1 ? childNames[0]
    : childNames.slice(0, -1).join(", ") + " & " + childNames[childNames.length - 1];

  const singleChild = story.children.length === 1;
  const sl = shareLabels(story.language);
  const dir = getDir(story.language as Language);

  return (
    <div className="relative min-h-screen overflow-x-hidden" dir={dir} style={{ background: "#040612" }}>
      {/* Atmospheric blurred background */}
      {story.coverUrl && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            backgroundImage: `url(${story.coverUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(60px) brightness(0.15) saturate(1.6)",
            transform: "scale(1.1)",
            zIndex: 0,
          }}
        />
      )}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 90% 50% at 50% 0%, rgba(79,195,247,0.07) 0%, transparent 70%)",
        zIndex: 1,
      }} />
      <StarField />

      <audio
        ref={audioRef}
        src={story.audioUrl}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
      />

      {/* Content */}
      <div className="relative flex flex-col items-center px-5 pt-10 pb-6" style={{ zIndex: 2 }}>

        {/* ── "Made with love for" — prominent, near the top ── */}
        {forLabel && (
          <div className="flex flex-col items-center mb-8">
            <p style={{
              color: "rgba(255,255,255,0.38)",
              fontSize: "var(--fs-body)",
              letterSpacing: 3,
              textTransform: "uppercase",
              marginBottom: 16,
            }}>
              ✨ {sl.madeWithLoveFor}
            </p>
            <div className="flex items-end justify-center" style={{ gap: story.children.length > 1 ? 28 : 0 }}>
              {story.children.map((child) => (
                <ChildBubble key={child.id} child={child} large={singleChild} />
              ))}
            </div>
          </div>
        )}

        {/* NightStory badge */}
        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded-full mb-6"
          style={{
            background: "rgba(5,8,20,0.75)",
            border: "1px solid rgba(79,195,247,0.25)",
            backdropFilter: "blur(8px)",
          }}
        >
          <span style={{ fontSize: 12 }}>🌙</span>
          <span style={{ color: "rgba(79,195,247,0.7)", fontSize: "var(--fs-label)", fontWeight: 700, letterSpacing: 1.5 }}>NightStory</span>
        </div>

        {/* Cover art — big and impressive */}
        <div className="relative mb-8 mx-auto" style={{ width: "min(88vw, 320px)", maxWidth: 320 }}>
          {/* Padding-bottom aspect-ratio trick: always reserves 1:1 space */}
          <div style={{ position: "relative", paddingBottom: "100%", borderRadius: 32, overflow: "hidden" }}>
            {story.coverUrl && !coverError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={story.coverUrl}
                alt={story.title}
                onError={() => setCoverError(true)}
                style={{
                  position: "absolute", inset: 0,
                  width: "100%", height: "100%",
                  objectFit: "cover",
                  borderRadius: 32,
                }}
              />
            ) : (
              <div style={{
                position: "absolute", inset: 0,
                background: "radial-gradient(ellipse at 40% 35%, rgba(79,195,247,0.3) 0%, rgba(10,6,24,0.95) 70%)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 96 }}>🌙</span>
              </div>
            )}
            {/* Overlay border */}
            <div style={{
              position: "absolute", inset: 0,
              borderRadius: 32,
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12), 0 16px 64px rgba(0,0,0,0.75), 0 0 80px rgba(79,195,247,0.12)",
              pointerEvents: "none",
            }} />
          </div>
          {/* Glow halo under cover */}
          <div style={{
            position: "absolute", bottom: -16, left: "15%", right: "15%", height: 32,
            background: "rgba(79,195,247,0.2)",
            filter: "blur(18px)",
            borderRadius: "50%",
            zIndex: -1,
          }} />
        </div>

        {/* Title */}
        <h1
          className="text-center font-bold mb-1"
          style={{
            fontSize: "var(--fs-title)",
            lineHeight: 1.2,
            background: "linear-gradient(135deg,#fff 0%,#4fc3f7 55%,#a78bfa 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            maxWidth: 340,
            filter: "drop-shadow(0 0 20px rgba(79,195,247,0.3))",
          }}
        >
          {story.title}
        </h1>

        {/* Personal message */}
        {story.shareMessage && (
          <div
            className="w-full mb-8"
            style={{
              maxWidth: 360,
              background: "rgba(79,195,247,0.04)",
              border: "1px solid rgba(79,195,247,0.15)",
              borderRadius: 20,
              padding: "18px 22px",
            }}
          >
            <p style={{ color: "rgba(79,195,247,0.5)", fontSize: "var(--fs-label)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
              💌 {sl.messageLabel}
            </p>
            <p style={{ color: "rgba(255,255,255,0.88)", fontSize: "var(--fs-body)", lineHeight: 1.7, fontStyle: "italic" }}>
              "{story.shareMessage}"
            </p>
          </div>
        )}

        {/* Play button */}
        <button
          onClick={handlePlayPause}
          className="flex items-center justify-center mb-5 transition-transform active:scale-95"
          style={{
            width: 96, height: 96, borderRadius: "50%",
            background: "linear-gradient(135deg,rgba(79,195,247,0.18),rgba(167,139,250,0.18))",
            border: "2px solid rgba(79,195,247,0.55)",
            boxShadow: playing
              ? "0 0 56px rgba(79,195,247,0.6), 0 0 100px rgba(79,195,247,0.25)"
              : "0 0 32px rgba(79,195,247,0.35)",
            color: "#fff",
            fontSize: 36,
          }}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "⏸" : "▶"}
        </button>

        {/* Progress bar */}
        <div className="flex items-center gap-3 w-full mb-10" style={{ maxWidth: 360 }}>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "var(--fs-body)", width: 36, textAlign: "right", flexShrink: 0 }}>
            {formatTime(currentTime)}
          </span>
          <div className="flex-1 relative" style={{ height: 4 }}>
            <div className="absolute inset-0 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
            <div
              className="absolute top-0 left-0 h-full rounded-full"
              style={{
                width: `${((currentTime / (duration || story.durationSeconds)) * 100).toFixed(1)}%`,
                background: "linear-gradient(90deg,#4fc3f7,#a78bfa)",
                transition: "width 0.5s linear",
              }}
            />
            <input
              type="range" min={0} max={duration || story.durationSeconds} step={0.5} value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
              style={{ height: "100%" }}
            />
          </div>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "var(--fs-body)", width: 36, flexShrink: 0 }}>
            {formatTime(duration || story.durationSeconds)}
          </span>
        </div>

        {/* Summary */}
        {story.summary && (
          <p className="text-center mb-10" style={{
            color: "rgba(255,255,255,0.3)", fontSize: "var(--fs-body)",
            lineHeight: 1.7, maxWidth: 320,
          }}>
            {story.summary}
          </p>
        )}

        {/* ── Promo banner ── */}
        <PromoBanner language={story.language} />

      </div>
    </div>
  );
}
