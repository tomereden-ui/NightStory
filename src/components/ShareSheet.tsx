"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { LibraryEntry } from "@/lib/libraryStore";
import type { DBChildProfile } from "@/app/api/child-profiles/route";

interface ShareSheetProps {
  story: LibraryEntry;
  children: DBChildProfile[];
  onClose: () => void;
  onMessageSaved?: (msg: string) => void;
}

// Follows the story's own language, not the sender's current app-UI
// language — the whole point of the share flow is to read naturally to
// whoever ends up on the other end of the link, and the story's language
// is the strongest signal for that (see SharePageClient.tsx for the same
// convention on the landing page itself).
type SheetLangKey =
  | "personalMessage" | "fallbackName" | "placeholderTemplate" | "hint" | "copyLink" | "linkCopied"
  | "shareWhatsApp" | "moreOptions" | "cancel" | "madeForTemplate" | "checkOutStory" | "listenHere";

const SHARE_SHEET_LABELS: Record<string, Record<SheetLangKey, string>> = {
  en: {
    personalMessage: "Personal message",
    fallbackName: "My little one",
    placeholderTemplate: "{name} designed a magical adventure today! It's fully personalised just for them, completely screen free, and feels like a real cinematic experience in their bedroom tonight 🌙",
    hint: "Shown on the story page for everyone who opens the link",
    copyLink: "Copy Link", linkCopied: "Link Copied!", shareWhatsApp: "Share via WhatsApp",
    moreOptions: "More options…", cancel: "Cancel",
    madeForTemplate: "I made a bedtime story for {name}!", checkOutStory: "Check out this bedtime story!", listenHere: "Listen here:",
  },
  he: {
    personalMessage: "הודעה אישית",
    fallbackName: "הקטנטן/ת שלי",
    placeholderTemplate: "{name} עיצב/ה הרפתקה קסומה היום! זה סיפור מותאם אישית לגמרי, ללא מסך לחלוטין, ומרגיש כמו חוויה קולנועית ממש בחדר שלהם הלילה 🌙",
    hint: "מוצג בדף הסיפור לכל מי שפותח את הקישור",
    copyLink: "העתקת קישור", linkCopied: "הקישור הועתק!", shareWhatsApp: "שיתוף ב-WhatsApp",
    moreOptions: "עוד אפשרויות…", cancel: "ביטול",
    madeForTemplate: "יצרתי סיפור לילה טוב עבור {name}!", checkOutStory: "תראו את סיפור הלילה הזה!", listenHere: "האזינו כאן:",
  },
  es: {
    personalMessage: "Mensaje personal",
    fallbackName: "Mi pequeño/a",
    placeholderTemplate: "¡{name} diseñó una aventura mágica hoy! Es una historia totalmente personalizada, sin pantallas, y se siente como una experiencia cinematográfica real en su habitación esta noche 🌙",
    hint: "Se muestra en la página de la historia para todos los que abran el enlace",
    copyLink: "Copiar enlace", linkCopied: "¡Enlace copiado!", shareWhatsApp: "Compartir por WhatsApp",
    moreOptions: "Más opciones…", cancel: "Cancelar",
    madeForTemplate: "¡Hice un cuento para dormir para {name}!", checkOutStory: "¡Mira este cuento para dormir!", listenHere: "Escúchalo aquí:",
  },
  fr: {
    personalMessage: "Message personnel",
    fallbackName: "Mon petit trésor",
    placeholderTemplate: "{name} a imaginé une aventure magique aujourd'hui ! C'est une histoire entièrement personnalisée, sans écran, qui ressemble à une véritable expérience cinématographique dans sa chambre ce soir 🌙",
    hint: "Affiché sur la page de l'histoire pour toute personne qui ouvre le lien",
    copyLink: "Copier le lien", linkCopied: "Lien copié !", shareWhatsApp: "Partager sur WhatsApp",
    moreOptions: "Plus d'options…", cancel: "Annuler",
    madeForTemplate: "J'ai créé une histoire du soir pour {name} !", checkOutStory: "Découvrez cette histoire du soir !", listenHere: "Écoutez ici :",
  },
  de: {
    personalMessage: "Persönliche Nachricht",
    fallbackName: "Mein Schatz",
    placeholderTemplate: "{name} hat heute ein magisches Abenteuer entworfen! Es ist eine voll personalisierte Geschichte, völlig bildschirmfrei, und fühlt sich heute Nacht wie ein echtes Kinoerlebnis im Kinderzimmer an 🌙",
    hint: "Wird auf der Geschichtenseite für jeden angezeigt, der den Link öffnet",
    copyLink: "Link kopieren", linkCopied: "Link kopiert!", shareWhatsApp: "Über WhatsApp teilen",
    moreOptions: "Weitere Optionen…", cancel: "Abbrechen",
    madeForTemplate: "Ich habe eine Gute-Nacht-Geschichte für {name} gemacht!", checkOutStory: "Schau dir diese Gute-Nacht-Geschichte an!", listenHere: "Hier anhören:",
  },
  pt: {
    personalMessage: "Mensagem pessoal",
    fallbackName: "Meu pequeno(a)",
    placeholderTemplate: "{name} criou uma aventura mágica hoje! É uma história totalmente personalizada, sem telas, e parece uma verdadeira experiência cinematográfica no quarto dele(a) esta noite 🌙",
    hint: "Exibido na página da história para todos que abrirem o link",
    copyLink: "Copiar link", linkCopied: "Link copiado!", shareWhatsApp: "Compartilhar no WhatsApp",
    moreOptions: "Mais opções…", cancel: "Cancelar",
    madeForTemplate: "Eu fiz uma história para dormir para {name}!", checkOutStory: "Veja esta história para dormir!", listenHere: "Ouça aqui:",
  },
  ar: {
    personalMessage: "رسالة شخصية",
    fallbackName: "صغيري",
    placeholderTemplate: "صمّم {name} مغامرة سحرية اليوم! إنها قصة مخصصة بالكامل، بلا شاشات تمامًا، وتبدو كتجربة سينمائية حقيقية في غرفته الليلة 🌙",
    hint: "تظهر في صفحة القصة لكل من يفتح الرابط",
    copyLink: "نسخ الرابط", linkCopied: "تم نسخ الرابط!", shareWhatsApp: "مشاركة عبر واتساب",
    moreOptions: "المزيد من الخيارات…", cancel: "إلغاء",
    madeForTemplate: "صنعت قصة ما قبل النوم من أجل {name}!", checkOutStory: "شاهدوا قصة ما قبل النوم هذه!", listenHere: "استمعوا هنا:",
  },
  ja: {
    personalMessage: "個人メッセージ",
    fallbackName: "うちの子",
    placeholderTemplate: "{name}が今日、魔法の冒険をデザインしました！完全にパーソナライズされた、画面を使わない物語で、今夜は寝室が本物の映画のような体験になります 🌙",
    hint: "リンクを開いたすべての人に物語ページで表示されます",
    copyLink: "リンクをコピー", linkCopied: "リンクをコピーしました！", shareWhatsApp: "WhatsAppで共有",
    moreOptions: "その他のオプション…", cancel: "キャンセル",
    madeForTemplate: "{name}のためにおやすみ物語を作りました！", checkOutStory: "このおやすみ物語をチェックしてください！", listenHere: "こちらで再生:",
  },
  it: {
    personalMessage: "Messaggio personale",
    fallbackName: "Il mio piccolo",
    placeholderTemplate: "{name} ha ideato un'avventura magica oggi! È una storia completamente personalizzata, senza schermo, e stasera sembrerà una vera esperienza cinematografica nella sua cameretta 🌙",
    hint: "Mostrato nella pagina della storia per chiunque apra il link",
    copyLink: "Copia link", linkCopied: "Link copiato!", shareWhatsApp: "Condividi su WhatsApp",
    moreOptions: "Altre opzioni…", cancel: "Annulla",
    madeForTemplate: "Ho creato una storia della buonanotte per {name}!", checkOutStory: "Guarda questa storia della buonanotte!", listenHere: "Ascolta qui:",
  },
  hi: {
    personalMessage: "व्यक्तिगत संदेश",
    fallbackName: "मेरा नन्हा",
    placeholderTemplate: "{name} ने आज एक जादुई रोमांच रचा! यह पूरी तरह व्यक्तिगत, स्क्रीन-मुक्त कहानी है, और आज रात उनके कमरे में एक असली सिनेमाई अनुभव जैसा महसूस होगा 🌙",
    hint: "लिंक खोलने वाले हर व्यक्ति को कहानी पेज पर दिखाया जाता है",
    copyLink: "लिंक कॉपी करें", linkCopied: "लिंक कॉपी हो गया!", shareWhatsApp: "WhatsApp पर शेयर करें",
    moreOptions: "और विकल्प…", cancel: "रद्द करें",
    madeForTemplate: "मैंने {name} के लिए एक सोने की कहानी बनाई!", checkOutStory: "यह सोने की कहानी देखें!", listenHere: "यहाँ सुनें:",
  },
};

function sheetLabels(language?: string): Record<SheetLangKey, string> {
  return SHARE_SHEET_LABELS[language ?? "en"] ?? SHARE_SHEET_LABELS.en;
}

function ChildAvatar({ child }: { child: DBChildProfile }) {
  const isUrl = child.avatar_emoji?.startsWith("http");
  return (
    <div
      className="rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
      style={{
        width: 36, height: 36,
        background: "linear-gradient(135deg,#4fc3f7,#f59e0b,#a78bfa)",
        padding: 2,
      }}
    >
      <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
        style={{ background: "#0a1628" }}>
        {isUrl
          ? <img src={child.avatar_emoji} alt={child.name} className="w-full h-full object-cover" />
          : <span style={{ fontSize: 18, lineHeight: 1 }}>{child.avatar_emoji || "🧒"}</span>
        }
      </div>
    </div>
  );
}

function ShareSheetInner({ story, children, onClose, onMessageSaved }: ShareSheetProps) {
  const sl = sheetLabels(story.language);
  const assignedChildren = children.filter((c) => story.childIds?.includes(c.id));
  const childNames = assignedChildren.map((c) => c.name);

  // Pre-filled as real, selectable/copyable text rather than shown only as
  // a placeholder — a browser placeholder can't be selected or copied,
  // which is exactly what made the suggested message uncopyable before.
  // Still fully editable/clearable like any normal textarea content.
  const [message, setMessage] = useState(
    story.shareMessage ?? sl.placeholderTemplate.replace("{name}", childNames[0] ?? sl.fallbackName)
  );
  const [saving, setSaving]   = useState(false);
  const [copied, setCopied]   = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger slide-in animation
    requestAnimationFrame(() => setMounted(true));
  }, []);
  const forLabel = childNames.length === 0 ? ""
    : childNames.length === 1 ? childNames[0]
    : childNames.slice(0, -1).join(", ") + " & " + childNames[childNames.length - 1];

  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== "undefined" ? window.location.origin : "");
  const storyUrl = `${siteOrigin}/story/${story.id}`;

  const shareText = [
    `🌙 ${forLabel ? sl.madeForTemplate.replace("{name}", forLabel) : sl.checkOutStory}`,
    message.trim() ? message.trim() : null,
    `${sl.listenHere} ${storyUrl}`,
  ].filter(Boolean).join(" ");

  const saveMessage = async () => {
    if (message === (story.shareMessage ?? "")) return;
    setSaving(true);
    try {
      await fetch(`/api/library/${story.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareMessage: message.trim() || null }),
      });
      onMessageSaved?.(message.trim());
    } finally {
      setSaving(false);
    }
  };

  const trackShare = (channel: string) => {
    fetch(`/api/story/${story.id}/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel }),
    }).catch(() => {});
  };

  const handleCopyLink = async () => {
    await saveMessage();
    await navigator.clipboard.writeText(storyUrl).catch(() => {});
    trackShare("copy");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = async () => {
    await saveMessage();
    trackShare("whatsapp");
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  };

  const handleNativeShare = async () => {
    await saveMessage();
    if (navigator.share) {
      trackShare("native");
      navigator.share({ title: story.title, text: shareText, url: storyUrl }).catch(() => {});
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{ zIndex: 9999, background: mounted ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0)", backdropFilter: "blur(6px)", transition: "background 0.25s ease" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          borderRadius: "24px 24px 0 0",
          background: "linear-gradient(180deg, #0d1225 0%, #080d1a 100%)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderBottom: "none",
          maxHeight: "88vh",
          overflowY: "auto",
          transform: mounted ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.35s cubic-bezier(0.32,0.72,0,1)",
          boxShadow: "0 -8px 48px rgba(0,0,0,0.6), 0 -1px 0 rgba(255,255,255,0.06)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
        </div>

        <div className="px-5 pt-2 pb-10 flex flex-col gap-4">

          {/* Story preview row */}
          <div
            className="flex items-center gap-3 p-3 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            {story.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={story.coverUrl} alt={story.title}
                style={{ width: 52, height: 52, borderRadius: 12, objectFit: "cover", flexShrink: 0, border: "1px solid rgba(255,255,255,0.1)" }} />
            ) : (
              <div style={{ width: 52, height: 52, borderRadius: 12, background: "rgba(79,195,247,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 26 }}>🌙</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate text-white" style={{ fontSize: "var(--fs-body)", marginBottom: 4 }}>{story.title}</p>
              {forLabel && (
                <div className="flex items-center gap-1.5">
                  <div className="flex" style={{ gap: -6 }}>
                    {assignedChildren.slice(0, 3).map((c) => <ChildAvatar key={c.id} child={c} />)}
                  </div>
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "var(--fs-body)" }}>for {forLabel}</span>
                </div>
              )}
            </div>
          </div>

          {/* Message field */}
          <div>
            <p className="mb-2" style={{ color: "rgba(255,255,255,0.4)", fontSize: "var(--fs-body)" }}>
              💌 {sl.personalMessage}
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={sl.placeholderTemplate.replace("{name}", childNames[0] ?? sl.fallbackName)}
              rows={3}
              className="w-full rounded-2xl px-4 py-3 text-white resize-none outline-none"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                fontSize: "var(--fs-body)",
                lineHeight: 1.6,
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(79,195,247,0.4)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
            />
            <p style={{ color: "rgba(255,255,255,0.18)", fontSize: "var(--fs-label)", marginTop: 6 }}>
              {sl.hint}
            </p>
          </div>

          {/* URL chip */}
          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: "rgba(79,195,247,0.05)", border: "1px solid rgba(79,195,247,0.12)" }}
          >
            <span style={{ fontSize: 14, flexShrink: 0 }}>🔗</span>
            <span className="flex-1 truncate" style={{ color: "rgba(255,255,255,0.3)", fontSize: "var(--fs-body)" }}>{storyUrl}</span>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 -4px" }} />

          {/* Copy link — primary */}
          <button
            onClick={handleCopyLink}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl font-bold transition-all active:scale-[0.98]"
            style={{
              background: copied
                ? "linear-gradient(135deg, rgba(79,195,247,0.25), rgba(167,139,250,0.25))"
                : "linear-gradient(135deg, rgba(79,195,247,0.15), rgba(167,139,250,0.15))",
              border: `1px solid ${copied ? "rgba(79,195,247,0.55)" : "rgba(79,195,247,0.3)"}`,
              color: "#4fc3f7",
              fontSize: "var(--fs-body)",
              boxShadow: copied ? "0 0 24px rgba(79,195,247,0.2)" : "none",
              transition: "all 0.2s",
            }}
          >
            {copied ? `✓ ${sl.linkCopied}` : `🔗 ${sl.copyLink}`}
          </button>

          {/* WhatsApp */}
          <button
            onClick={handleWhatsApp}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            style={{
              background: "rgba(37,211,102,0.08)",
              border: "1px solid rgba(37,211,102,0.25)",
              color: "#25D366",
              fontSize: "var(--fs-body)",
            }}
          >
            <span>💬</span> {sl.shareWhatsApp}
          </button>

          {/* Native share */}
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button
              onClick={handleNativeShare}
              className="w-full py-3 rounded-2xl font-semibold transition-all active:scale-[0.98]"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.09)",
                color: "rgba(255,255,255,0.4)",
                fontSize: "var(--fs-body)",
              }}
            >
              {sl.moreOptions}
            </button>
          )}

          {/* Cancel */}
          <button
            onClick={onClose}
            className="text-center py-1"
            style={{ color: "rgba(255,255,255,0.2)", fontSize: "var(--fs-body)" }}
          >
            {sl.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ShareSheet(props: ShareSheetProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(<ShareSheetInner {...props} />, document.body);
}
