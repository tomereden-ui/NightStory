// One-off backfill: create a family + owner family_members row for every
// existing auth.users row that has none (signed up before the
// family-auto-provision trigger fix existed), then reattribute the one
// known orphaned story (gsudai@gmail.com's "Hila and Tulitul in the Candy
// Kingdom", family_id NULL) to the family just created for him.
const fs = require("fs");

for (const rawLine of fs.readFileSync("C:/Users/Tomer/NightStory/.env.local", "utf8").split("\n")) {
  const line = rawLine.replace(/\r$/, "");
  const eq = line.indexOf("=");
  if (eq === -1) continue;
  process.env[line.slice(0, eq)] = line.slice(eq + 1);
}
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

async function authAdmin() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const body = await res.json();
  return body.users;
}

const GIL_STORY_ID = "89a87ca1-2346-4f2f-8dd0-72ab611e961e";
const GIL_EMAIL = "gsudai@gmail.com";

async function main() {
  const users = await authAdmin();
  const existingMembers = await sb("family_members?select=user_id");
  const hasFamily = new Set(existingMembers.map((m) => m.user_id));

  const orphaned = users.filter((u) => !hasFamily.has(u.id));
  console.log(`${orphaned.length} user(s) with no family:`, orphaned.map((u) => u.email));

  for (const u of orphaned) {
    const displayName = u.user_metadata?.full_name || u.user_metadata?.name || null;
    const [family] = await sb("families", {
      method: "POST",
      body: JSON.stringify({ name: `${displayName || "My"}'s Family` }),
    });
    await sb("family_members", {
      method: "POST",
      prefer: "return=minimal",
      body: JSON.stringify({ family_id: family.id, user_id: u.id, role: "owner" }),
    });
    console.log(`Provisioned family ${family.id} ("${family.name}") for ${u.email}`);

    if (u.email === GIL_EMAIL) {
      await sb(`stories?id=eq.${GIL_STORY_ID}&family_id=is.null`, {
        method: "PATCH",
        prefer: "return=representation",
        body: JSON.stringify({ family_id: family.id }),
      }).then((rows) => {
        console.log(rows.length > 0
          ? `Reattributed story ${GIL_STORY_ID} to ${u.email}'s new family.`
          : `Story ${GIL_STORY_ID} already had a family_id (nothing to do) or wasn't found.`);
      });
    }
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
