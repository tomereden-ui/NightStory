import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { geminiPost, geminiText } from "@/lib/geminiClient";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const AGE_BUCKETS = ["toddler", "child", "teen", "young_adult", "middle_aged", "elderly"] as const;
type AgeBucket = (typeof AGE_BUCKETS)[number];

const CATEGORIES = ["human", "animal", "plant", "object", "fantasy"] as const;
type Category = (typeof CATEGORIES)[number];

const BATCH_SIZE = 50;

interface BankRow { id: string; description: string; type: string | null }
interface RowLabels { age: AgeBucket | null; category: Category | null }

function stripJsonFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
}

async function classifyBatch(rows: BankRow[], apiKey: string): Promise<RowLabels[]> {
  const list = rows.map((r, i) => `${i + 1}. [${r.type ?? "unknown"}] ${r.description}`).join("\n");
  const prompt = `You are labeling character-portrait descriptions for a children's story app. For EACH numbered description, assign:

"age": one of ${AGE_BUCKETS.join(", ")} — or null when age genuinely isn't discernible (fine for animals/objects).
"category": exactly one of:
  human   — people of any age (children, adults, elders, wizards who are human)
  animal  — real-world animals (dogs, owls, pigs, bears...)
  plant   — trees, flowers, plants, mushrooms
  object  — inanimate things brought to life (balloons, robots, vehicles, toys, lights)
  fantasy — mythical beings (dragons, unicorns, fairies, monsters)

Descriptions (numbered):
${list}

Return ONLY raw JSON, no markdown: {"labels": [{"age": <bucket or null>, "category": <category>}, ...]} — exactly ${rows.length} entries, same order as above.`;

  try {
    const { data } = await geminiPost(apiKey, "gemini-3.5-flash", {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 8192, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
    }, { callType: "avatar_age_backfill" });
    const parsed = JSON.parse(stripJsonFences(geminiText(data) ?? "")) as { labels?: { age?: string | null; category?: string | null }[] };
    const labels = parsed.labels ?? [];
    return rows.map((_, i) => {
      const l = labels[i] ?? {};
      return {
        age: l.age && (AGE_BUCKETS as readonly string[]).includes(l.age) ? (l.age as AgeBucket) : null,
        category: l.category && (CATEGORIES as readonly string[]).includes(l.category) ? (l.category as Category) : null,
      };
    });
  } catch (err) {
    console.error("[backfill-avatar-ages] batch classification failed:", err);
    return rows.map(() => ({ age: null, category: null }));
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 500 });

  let body: { onlyMissing?: boolean };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  let query = supabase.from("avatar_bank").select("id, description, type, age_bucket, category");
  if (body.onlyMissing) query = query.is("category", null);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: `Fetch failed: ${error.message}` }, { status: 500 });

  const rows = (data ?? []) as Array<BankRow & { age_bucket: string | null; category: string | null }>;
  if (rows.length === 0) {
    return NextResponse.json({ totalRows: 0, updated: 0 });
  }

  let updated = 0;
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const labels = await classifyBatch(batch, apiKey);
    for (let j = 0; j < batch.length; j++) {
      const l = labels[j];
      if (!l.age && !l.category) continue;
      const patch: Record<string, string> = {};
      if (l.age) patch.age_bucket = l.age;
      if (l.category) patch.category = l.category;
      const { error: updErr } = await supabase.from("avatar_bank").update(patch).eq("id", batch[j].id);
      if (updErr) errors.push(`${batch[j].id}: ${updErr.message}`);
      else updated++;
    }
  }

  return NextResponse.json({ totalRows: rows.length, updated, failed: errors.length, errors: errors.slice(0, 20) });
}
