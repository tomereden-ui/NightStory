// One-off backfill: link existing "Title - פרק N" classics into series via
// the new series_id/chapter_number/chapter_count columns (chapters-migration.sql).
const fs = require("fs");
const crypto = require("crypto");

for (const rawLine of fs.readFileSync("C:/Users/Tomer/NightStory/.env.local", "utf8").split("\n")) {
  const line = rawLine.replace(/\r$/, "");
  const eq = line.indexOf("=");
  if (eq === -1) continue;
  process.env[line.slice(0, eq)] = line.slice(eq + 1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CHAPTER_RE = /\s*-\s*פרק\s*(\d+)\s*$/;

async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: opts.prefer ?? "return=representation",
      ...opts.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${path}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const rows = await sb(
    "stories?select=id,title&is_classic=eq.true&is_public=eq.true"
  );

  const groups = new Map(); // baseTitle -> [{id, chapterNumber}]
  for (const r of rows) {
    const m = r.title.match(CHAPTER_RE);
    if (!m) continue;
    const base = r.title.replace(CHAPTER_RE, "").trim();
    const chapterNumber = Number(m[1]);
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push({ id: r.id, chapterNumber });
  }

  let updated = 0;
  for (const [base, chapters] of groups) {
    if (chapters.length < 2) {
      console.log(`Skip "${base}" — only ${chapters.length} chapter(s) found, nothing to link yet`);
      continue;
    }
    const seriesId = crypto.randomUUID();
    const chapterCount = chapters.length;
    console.log(`Linking "${base}" — ${chapterCount} chapters, seriesId=${seriesId}`);
    for (const ch of chapters) {
      await sb(`stories?id=eq.${ch.id}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: JSON.stringify({
          series_id: seriesId,
          chapter_number: ch.chapterNumber,
          chapter_count: chapterCount,
        }),
      });
      updated++;
    }
  }
  console.log(`Done. ${updated} story rows updated.`);
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
