# AI Instruction Ledger

A complete inventory of every place NightStory sends instructions/prompts to an AI model — where each one fires from, what it's telling the model to do, and whether that instruction lives inline in source or in a loadable config file.

**45 instruction sites across 17 feature areas.** Only two files under `config/` hold actual instruction text — `gemini-chat-guide.txt` (Luna's chat persona) and `story-guidance.txt` (story-writing rules, reused by 4 different routes). Everything else is inline in the `.ts` source as a template string or constant.

Models in use: `gemini-3.5-flash` (text/JSON, the default), `gemini-2.5-flash-image` / `gemini-3.1-flash-image` (image generation), `gemini-2.5-flash-preview-tts` (narrator audio), and ElevenLabs (sound-generation + Hebrew/cloned-voice TTS).

---

## 1. Luna Chat

Studio2 → **Chat with Luna** tab · `src/components/studio/LunaChatPanel.tsx`

| File | Nature | Format |
|---|---|---|
| `api/chat/route.ts` — `loadChatGuide()` | System instruction defining Luna's persona, conversational rules, and the STORY_READY signal format. (`gemini-3.5-flash`) | **External** — `config/gemini-chat-guide.txt` |
| `api/chat/route.ts` — `buildChildContext()` | Injects the active child's name, age, interests, and avoid-list into the system instruction. | Inline |
| `api/chat/route.ts` — `languageOverride()` | Forces the reply language once the user has explicitly picked one for this story. | Inline |
| `api/chat/route.ts` — `detectExplicitGoAhead()` | Tiny true/false classifier — did the user just say "let's go / start now"? (`gemini-3.5-flash`) | Inline |

## 2. Story Generation

Studio2 → **Prompt tab** & chat-confirmed wizard stories · `api/generate-story/route.ts`

| File | Nature | Format |
|---|---|---|
| `readGuidance()` + `buildSystemInstruction()` | Story-writing guidance, tone/format rules, age-tiered language-level rules, language & niqqud rules, hard "avoid" list, title-uniqueness rule, plus runtime numeric targets (word/block count). (`gemini-3.5-flash`) | **External** guidance body — `config/story-guidance.txt`; runtime wrapper inline |

## 3. Five-Question Wizard Generation

Studio2 → **Step-by-step tab** · `src/app/create/five-question/FiveQuestionFlow.tsx`

| File | Nature | Format |
|---|---|---|
| `api/five-question-story/route.ts` — `readGuidance()` + `buildSystemInstruction()` | Same story-writing guidance as above, simplified wrapper (no age-tier or lesson sections — this flow has none). (`gemini-3.5-flash`) | **External** — `config/story-guidance.txt` |
| `api/five-question-story/route.ts` — `buildUserPrompt()` | Assembles the 5 seed answers (hero/world/companion/challenge/mood) into a story brief, with a companion-ability resolution rule. | Inline |

## 4. Wizard Field Validation

5-question wizard's free-text fields (hero/world/companion/challenge) · the animal "+" chip

| File | Nature | Format |
|---|---|---|
| `api/validate-wizard-text/route.ts` | Appropriateness + clarity check on hero name / world / companion name / challenge text; returns approve or a localized rejection line. (`gemini-3.5-flash`) | Inline |
| `api/validate-animal/route.ts` | "Is this a recognizable animal?" classifier + appropriateness check; also returns an English name, an emoji, and 4 name suggestions. (`gemini-3.5-flash`) | Inline |
| `api/suggest-names/route.ts` | Suggests 4 short, whimsical companion names. (`gemini-3.5-flash`) | Inline |

## 5. Script Editing

Studio2 → **Script tab** · `ScriptTab.tsx`, `ScriptBlockCard.tsx`

| File | Nature | Format |
|---|---|---|
| `api/validate-text/route.ts` | Single-block gibberish/appropriateness check for one edited script line. (`gemini-3.5-flash`) | Inline |
| `api/validate-blocks/route.ts` | Batch age-appropriateness + proofreading pass across all script blocks; returns only the blocks it changed. (`gemini-3.5-flash`) | Inline |
| `api/validate-script/route.ts` | Full-script policy reviewer checked against the story-guidance rules; returns fixes only for violating blocks. (`gemini-3.5-flash`) | **External** — `config/story-guidance.txt` |
| `api/validate-direction/route.ts` | Gate on the free-text "Director's Note" — checks the instruction is reasonable and doesn't contradict the selected mood chips. (`gemini-3.5-flash`) | Inline |
| `api/revise-script/route.ts` | Applies a director's revision instruction under a minimal-edit rule, with optional moral-lesson weaving. (`gemini-3.5-flash`) | Inline |
| `api/insert-block/route.ts` | Writes 1–2 new dialogue/SFX blocks at a marked insertion point, using surrounding context. (`gemini-3.5-flash`) | Inline |
| `api/admin/suggest-sfx/route.ts` | Sound-designer pass suggesting 3–6 SFX insertion points with descriptions. (`gemini-3.5-flash`) | **External** — sliced from `story-guidance.txt` (SFX section) |

## 6. Cover Image Generation

5-question wizard finish · Studio2 cover regen · Admin panel · `src/config/coverImageInstructions.ts`

| File | Nature | Format |
|---|---|---|
| `buildCoverRewriterPrompt()` | Rewrites a story hint/summary into a full Pixar-style cover prompt (character preservation, night theme, child-safety rules). (`gemini-3.5-flash` rewrite → `gemini-2.5-flash-image`) | Inline |
| `buildCoverScenePrompt()` | Extracts a visual scene description straight from script blocks when no cover prompt exists yet (produce-drama fallback path). (`gemini-3.5-flash`) | Inline |
| `buildFinalCoverPrompt()` | Wraps the scene description with final style/lighting/composition instructions before the image model. (`gemini-3.1-flash-image`) | Inline |
| `api/admin/story-meta/route.ts` | Admin tool: derives a summary, age-group classification, and a named-character cover prompt from an existing script in one call. (`gemini-3.5-flash`) | Inline |

A generic fallback cover prompt (`COVER_FALLBACK_PROMPT`) also lives inline in this file, used only if the story-specific prompt itself trips the safety filter.

## 7. Character Avatar Generation & Matching

Studio2 cast panel · Child Profile Picker · Admin avatar tools

| File | Nature | Format |
|---|---|---|
| `api/generate-avatar/route.ts` — `buildAvatarPrompt()` | Bespoke Pixar-style circular portrait prompt per cast character. (`gemini-3.1-flash-image`) | Inline |
| `services/characterClassifier.ts` — `classifyCharacters()` | Classifies each character's type (child/adult/animal), gender, age bucket, category, and writes a 10–15 word visual description from the script. (`gemini-3.5-flash`, JSON) | Inline |
| `services/avatarBankService.ts` — `findBestAvatar()` | Matches a bare text description to the closest pre-made bank avatar. (`gemini-3.5-flash`) | Inline |
| `services/avatarBankService.ts` — `findBestAvatarForCharacter()` | Same matching task, profile-based (type/gender/age-bucket/description) — used in production and admin retrofits. (`gemini-3.5-flash`) | Inline |
| `config/avatarBankPrompts.ts` | 50 fixed portrait prompts for the curated avatar bank, plus a shared style suffix. (`gemini-3.1-flash-image`) | Inline |
| `api/admin/backfill-avatar-ages/route.ts` — `classifyBatch()` | Admin batch-labels existing `avatar_bank` rows with age-bucket + category from their description text. (`gemini-3.5-flash`, JSON) | Inline |

## 8. Voice Casting

Fires during every story generation & production pipeline (not a screen of its own)

| File | Nature | Format |
|---|---|---|
| `services/voiceAssignment.ts` — `buildCastingPrompt()` | Casting-director prompt reasoning over the full voice catalog's pitch/pace/energy/texture data to cast each character to a distinct voice. (`gemini-3.5-flash`) | Inline — catalog data in `config/voice-catalog.json` |
| `services/characterProfiler.ts` — `profileCharacters()` | Older, parallel casting-director prompt (archetype research → voice spec → persona text), still called alongside the one above inside produce-drama. (`gemini-3.5-flash`, JSON) | Inline |

The `persona` string this second prompt produces is threaded through to TTS synthesis as a `systemInstruction` param, but Gemini TTS doesn't accept one — a comment in `ttsService.ts` confirms it's currently inert.

## 9. Scene Breakdown

Powers the Studio2 **Scene Map** view · fires during generation and admin scene regen

| File | Nature | Format |
|---|---|---|
| `services/sceneGenerator.ts` — `readSceneGuidance()` | Segments a finished script into 3–5 scenes with mood, SFX tags, and line ranges. (`gemini-3.5-flash`) | **External** — sliced from `story-guidance.txt` (scene section) |

## 10. Drama Production Pipeline

Studio2 → **Produce** action · `api/produce-drama/route.ts`

| File | Nature | Format |
|---|---|---|
| `services/dramaPlanner.ts` — `SYSTEM_INSTRUCTION` | Audio-drama timeline producer: word-duration timing rules, speaker-gap rules, SFX phrasing rules, output JSON format. (`gemini-3.5-flash`) | Inline |
| `api/produce-drama/route.ts` — `detectScriptLanguage()` | Tiny classifier — detects the script's ISO 639-1 language code. (`gemini-3.5-flash`) | Inline |

This route otherwise orchestrates the character classifier, avatar matcher, voice casters, scene generator, and cover builder above — no new instruction text of its own.

## 11. Admin Retrofit Tools

Admin panel — reapplies generation-time logic to already-produced stories

| File | Nature | Format |
|---|---|---|
| `services/storyPolicies.ts` — `buildLessonsSystemInstruction()` | Identifies which values from the canonical lesson catalog are meaningfully embedded in a script. (`gemini-3.5-flash`) | Inline |
| `services/storyPolicies.ts` — `deriveSummaryForStory()` | Writes a 1–2 sentence hook summary for an existing script. (`gemini-3.5-flash`) | Inline |

Wired up by `admin/reassign-voices`, `admin/reassign-avatars`, `admin/regenerate-scenes`, `analyze-lessons`, `admin/refresh-story`, and `admin/backfill-character-profiles` — each re-runs the relevant prompt above against a persisted story rather than defining new instruction text.

## 12. Wizard Option-Card Art

5-question wizard — every illustrated hero/world/companion/challenge/mood card, seeded on first load

| File | Nature | Format |
|---|---|---|
| `config/createFlowImages.ts` | Fixed Pixar-3D prompt per option card — 6 hero, 14 world, 4 companion, 4 challenge, 4 mood, 7 profile-setting prompts. (`gemini-2.5-flash-image`, sent via `admin/seed-create-images`) | Inline |

## 13. Voice Preview / Sample Generation

**Voice Manager** screen · wizard narration audio · voice picker avatars

| File | Nature | Format |
|---|---|---|
| `api/admin/generate-voice-samples/route.ts` | Plain TTS synthesis of a canned or custom preview sentence per voice × language — no creative prompt. (Gemini TTS / ElevenLabs) | Inline — sentences in `voicePreviewSamples.ts` |
| `api/admin/seed-bluebell-audio/route.ts` | Fixed narrator intro lines (5 per language) plus a one-line "Speak in {language}" instruction. (`gemini-2.5-flash-preview-tts`) | Inline |
| `app/voices/page.tsx` | Client-side: generates/caches voice-picker portrait art directly from the browser. (Pollinations Flux) | Inline — prompts in `config/voiceAvatars.ts` |
| `services/voiceAvatarService.ts` — `buildAvatarPrompt()` | Alternate voice-avatar prompt builder — no remaining callers found; appears orphaned. (Pollinations Flux) | Inline |

## 14. Shared Helpers

Reused across generation, production, and admin retrofit routes

| File | Nature | Format |
|---|---|---|
| `services/scriptGenerationHelpers.ts` — `detectGeneratedLanguage()` | Tiny classifier — what language is this text? Returns an ISO 639-1 code. (`gemini-3.5-flash`) | Inline |
| `services/scriptGenerationHelpers.ts` — `resolveTitleConflict()` | Suggests an alternative story title given a summary and a list of titles to avoid. (`gemini-3.5-flash`) | Inline |
| `api/produce-drama/route.ts` — `detectScriptLanguage()` | Duplicate of the language-detection logic above, reimplemented locally with the REST wrapper instead of the SDK. (`gemini-3.5-flash`) | Inline |

## 15. Classics Catalog

Library → **Classics** shelf · auto-generated on first request, then cached

| File | Nature | Format |
|---|---|---|
| `api/classics/route.ts` | Writes each classic from a hardcoded per-title brief (fairy tale, fable, etc). (`gemini-3.5-flash`) | Inline — briefs in `lib/classicStories.ts` |
| `api/classics/route.ts` & `[id]/cover/route.ts` | Generates each classic's cover from its own hardcoded cover prompt. (Pollinations Flux) | Inline — prompts in `lib/classicStories.ts` |

## 16. Sound Effects

Studio2 Script tab "Preview SFX" · drama production pipeline

| File | Nature | Format |
|---|---|---|
| `services/sfxService.ts` — `generateSfx()` | Sends an SFX description (authored upstream by the drama planner, the SFX-suggester, or typed by the user) straight to ElevenLabs as the sound-generation instruction. (ElevenLabs sound-generation) | N/A — text generated upstream, not here |

## 17. Debug Endpoint

Internal only — not reachable from any app screen

| File | Nature | Format |
|---|---|---|
| `api/admin/test-imagen/route.ts` | Hardcoded test prompt ("a small red apple") to probe image-model availability. (`gemini-2.0-flash-preview-image-generation`) | Inline |

---

## Notes

- `lib/geminiClient.ts` is a thin REST wrapper (`geminiPost` / `geminiText`) with token tracking — no prompt text of its own.
- `config/` holds exactly three files: `gemini-chat-guide.txt`, `story-guidance.txt`, and `voice-catalog.json` (structured voice data, not an instruction). Every "External" entry above points to one of the first two.
- `config/ttsEngines.ts` is engine on/off configuration only — no instruction text.
- `lib/services/ttsService.ts` is pure dispatch/fallback logic between TTS providers; its only instruction-shaped content is deterministic SSML prosody tagging, not AI-generated.
