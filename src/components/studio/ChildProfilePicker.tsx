"use client";

import { useState, useEffect, useRef } from "react";
import { MOCK_USER } from "@/lib/mockData";
import type { DBChildProfile } from "@/app/api/child-profiles/route";
import Icon from "@/components/ui/Icon";

export type { DBChildProfile };

// ─── Add profile modal ────────────────────────────────────────────────────────

const THEME_OPTIONS = [
  { id: "adventure", label: "Adventure", emoji: "⚔️" },
  { id: "fantasy",   label: "Fantasy",   emoji: "🧚" },
  { id: "animals",   label: "Animals",   emoji: "🐾" },
  { id: "bedtime",   label: "Bedtime",   emoji: "🌙" },
  { id: "nature",    label: "Nature",    emoji: "🌿" },
  { id: "space",     label: "Space",     emoji: "🚀" },
  { id: "fairy-tale",label: "Fairy tale",emoji: "👑" },
  { id: "friendship",label: "Friendship",emoji: "🤝" },
];

const AVATAR_OPTIONS = ["⭐","🌸","🚀","🦁","🌙","🦋","🐉","🦊","🐼","🦄","🧚","🌟","🐬","🌺","🧸","🐧"];

function AddProfileModal({
  onAdd,
  onClose,
}: {
  onAdd: (p: DBChildProfile) => void;
  onClose: () => void;
}) {
  const [name, setName]     = useState("");
  const [age, setAge]       = useState("");
  const [gender, setGender] = useState<"boy" | "girl" | "other">("other");
  const [avatar, setAvatar] = useState("⭐");
  const [themes, setThemes] = useState<string[]>([]);
  const [interests, setInterests] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleTheme(id: string) {
    setThemes((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  }

  async function handleSave() {
    const trimName = name.trim();
    const parsedAge = parseInt(age, 10);
    if (!trimName || isNaN(parsedAge) || parsedAge < 1 || parsedAge > 16) return;

    setSaving(true);
    try {
      const res = await fetch("/api/child-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimName,
          age: parsedAge,
          gender,
          avatar_emoji: avatar,
          favorite_themes: themes,
          interests,
        }),
      });
      if (res.ok) {
        const created = await res.json() as DBChildProfile;
        onAdd(created);
        onClose();
      }
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl flex flex-col overflow-hidden"
        style={{ background: "rgba(8,12,24,0.98)", border: "1px solid rgba(255,255,255,0.09)", maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-0.5 flex-shrink-0" style={{ background: "linear-gradient(90deg,#4fc3f7,#8B5CF6)" }} />

        <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
          <p className="text-white font-bold text-sm">Add child profile</p>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white/70"
            style={{ background: "rgba(255,255,255,0.06)" }}><Icon name="close" size={12} /></button>
        </div>

        <div className="overflow-y-auto px-5 pb-6 flex flex-col gap-4">
          {/* Avatar picker */}
          <div className="flex justify-center">
            <div className="grid grid-cols-8 gap-1.5">
              {AVATAR_OPTIONS.map((em) => (
                <button
                  key={em}
                  onClick={() => setAvatar(em)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-xl transition-all"
                  style={{
                    background: avatar === em ? "rgba(79,195,247,0.15)" : "rgba(255,255,255,0.04)",
                    border: avatar === em ? "1.5px solid rgba(79,195,247,0.5)" : "1px solid rgba(255,255,255,0.07)",
                  }}
                >{em}</button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-white/40 text-[10px] uppercase tracking-widest font-bold block mb-1.5">Name</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Child's name" maxLength={30}
              className="w-full px-4 py-3 rounded-2xl text-white text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
          </div>

          {/* Age + Gender row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-white/40 text-[10px] uppercase tracking-widest font-bold block mb-1.5">Age</label>
              <input
                type="number" value={age} onChange={(e) => setAge(e.target.value)}
                placeholder="1–16" min={1} max={16}
                className="w-full px-4 py-3 rounded-2xl text-white text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              />
            </div>
            <div className="flex-1">
              <label className="text-white/40 text-[10px] uppercase tracking-widest font-bold block mb-1.5">Gender</label>
              <div className="flex gap-1.5">
                {(["boy","girl","other"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className="flex-1 py-3 rounded-2xl text-xs font-semibold capitalize transition-all"
                    style={{
                      background: gender === g ? "rgba(79,195,247,0.12)" : "rgba(255,255,255,0.04)",
                      border: gender === g ? "1.5px solid rgba(79,195,247,0.45)" : "1px solid rgba(255,255,255,0.08)",
                      color: gender === g ? "#4fc3f7" : "rgba(255,255,255,0.4)",
                    }}
                  >{g}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Favourite themes */}
          <div>
            <label className="text-white/40 text-[10px] uppercase tracking-widest font-bold block mb-2">Favourite story themes</label>
            <div className="flex flex-wrap gap-1.5">
              {THEME_OPTIONS.map((t) => {
                const active = themes.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleTheme(t.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                    style={{
                      background: active ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.04)",
                      border: active ? "1.5px solid rgba(139,92,246,0.5)" : "1px solid rgba(255,255,255,0.08)",
                      color: active ? "#a78bfa" : "rgba(255,255,255,0.4)",
                    }}
                  >
                    <span>{t.emoji}</span> {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interests */}
          <div>
            <label className="text-white/40 text-[10px] uppercase tracking-widest font-bold block mb-1.5">Interests <span className="normal-case opacity-60">(optional)</span></label>
            <input
              type="text" value={interests} onChange={(e) => setInterests(e.target.value)}
              placeholder="e.g. dinosaurs, robots, soccer, unicorns"
              className="w-full px-4 py-3 rounded-2xl text-white text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
          </div>

          <button
            onClick={handleSave}
            disabled={!name.trim() || !age || saving}
            className="w-full py-3.5 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-30"
            style={{ background: "linear-gradient(135deg,#4fc3f7,#8B5CF6)" }}
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Child avatar — bank lookup (cached in module-level map for the session) ──

const avatarCache = new Map<string, string>();

async function fetchChildAvatar(profile: DBChildProfile): Promise<string | null> {
  const cacheKey = `${profile.id}-${profile.gender}`;
  if (avatarCache.has(cacheKey)) return avatarCache.get(cacheKey)!;

  // Use stored avatar_url if already resolved (from DB or a previous session)
  if ((profile as DBChildProfile & { avatar_url?: string }).avatar_url) {
    const url = (profile as DBChildProfile & { avatar_url?: string }).avatar_url!;
    avatarCache.set(cacheKey, url);
    return url;
  }

  const age = profile.age ?? 6;
  const genderWord = profile.gender === "other" ? "child" : profile.gender ?? "child";
  const description = `${age} year old ${genderWord} named ${profile.name}`;

  try {
    const res = await fetch("/api/avatar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    });
    if (!res.ok) return null;
    const { avatarUrl } = await res.json() as { avatarUrl: string | null };
    if (avatarUrl) avatarCache.set(cacheKey, avatarUrl);
    return avatarUrl ?? null;
  } catch {
    return null;
  }
}

// ─── Picker strip ─────────────────────────────────────────────────────────────

export default function ChildProfilePicker({
  selected,
  onChange,
  disabled = false,
}: {
  selected: DBChildProfile | null;
  onChange: (profile: DBChildProfile | null) => void;
  disabled?: boolean;
}) {
  const [profiles, setProfiles] = useState<DBChildProfile[]>([]);
  const [showAdd, setShowAdd]   = useState(false);
  const [loaded, setLoaded]     = useState(false);
  const [bankAvatars, setBankAvatars] = useState<Record<string, string>>({});
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/child-profiles", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: DBChildProfile[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setProfiles(data);
          if (!selected) onChange(data[0]);
        } else {
          const fallback: DBChildProfile[] = MOCK_USER.childProfiles.map((c) => ({
            id: c.id,
            name: c.name,
            age: c.age ?? 6,
            gender: "other" as const,
            avatar_emoji: c.avatarEmoji,
            favorite_animals: [],
            favorite_themes: (c.favoriteCategories ?? []) as string[],
            interests: "",
            notes: "",
            created_at: 0,
            updated_at: 0,
          }));
          setProfiles(fallback);
          if (!selected && fallback.length > 0) onChange(fallback[0]);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load bank avatars for all profiles (fires after profiles are set)
  useEffect(() => {
    if (profiles.length === 0) return;
    for (const p of profiles) {
      if (fetchedRef.current.has(p.id)) continue;
      fetchedRef.current.add(p.id);
      fetchChildAvatar(p).then((url) => {
        if (url) setBankAvatars((prev) => ({ ...prev, [p.id]: url }));
      });
    }
  }, [profiles]);

  function handleAdd(profile: DBChildProfile) {
    setProfiles((prev) => [...prev, profile]);
    onChange(profile);
    // Trigger avatar fetch for the new profile
    fetchChildAvatar(profile).then((url) => {
      if (url) setBankAvatars((prev) => ({ ...prev, [profile.id]: url }));
    });
  }

  if (!loaded) return null;

  return (
    <>
      <div className="mb-5">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.28)" }}>
          Creating for
        </p>
        <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {profiles.map((p) => {
            const isActive = selected?.id === p.id;
            const avatarUrl = bankAvatars[p.id];
            return (
              <button
                key={p.id}
                onClick={() => { if (!disabled) onChange(isActive ? null : p); }}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 transition-all active:scale-95"
                style={{ width: 64, opacity: disabled && !isActive ? 0.35 : 1, cursor: disabled ? "default" : "pointer" }}
              >
                <div
                  className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 transition-all flex items-center justify-center"
                  style={isActive
                    ? { border: "2px solid rgba(79,195,247,0.75)", boxShadow: "0 0 18px rgba(79,195,247,0.3), 0 4px 12px rgba(0,0,0,0.4)", background: "#07091a" }
                    : { border: "1.5px solid rgba(255,255,255,0.1)", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", background: "#07091a" }
                  }
                >
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">{p.avatar_emoji || "⭐"}</span>
                  )}
                </div>
                <span
                  className="text-[11px] font-bold text-center truncate w-full leading-tight"
                  style={{ color: isActive ? "#4fc3f7" : "rgba(255,255,255,0.6)" }}
                >
                  {p.name}
                </span>
              </button>
            );
          })}

        </div>
      </div>

      {showAdd && (
        <AddProfileModal onAdd={handleAdd} onClose={() => setShowAdd(false)} />
      )}
    </>
  );
}
