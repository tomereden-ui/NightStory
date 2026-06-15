# NightStory — Voices & SFX Prompts

This file consolidates all AI instructions used when casting voices, generating character
personas, running TTS, and generating sound effects.
Source files: `src/lib/services/characterProfiler.ts`, `src/lib/services/ttsService.ts`,
`src/lib/services/sfxService.ts`, `src/app/api/voices/preview/route.ts`, `src/lib/services/dramaPlanner.ts`

---

## 1. ElevenLabs Voice Pool
_Used by: `src/lib/services/characterProfiler.ts` and `src/lib/services/voiceMap.ts`_

These are the 8 ElevenLabs preset voices available for character assignment:

| Label    | Voice ID                       | Description |
|----------|-------------------------------|-------------|
| Adam     | `pNInz6obpgDQGcFmaJgB`        | Deep, warm baritone male — authoritative, trustworthy narrator quality |
| Emily    | `LcfcDJNUP1GQjkzn1xUU`        | Soft, gentle female — nurturing, calm, reassuring |
| Arnold   | `VR6AewLTigWG4xSOukaG`        | Strong, bold male — energetic, adventurous, determined |
| Rachel   | `21m00Tcm4TlvDq8ikWAM`        | Warm, expressive female — emotional, storyteller quality, heartfelt |
| Harry    | `SOYHLrjzK2X1ezoPC6cr`        | Bright, playful young male — child-like, mischievous, light and bouncy |
| Elli     | `MF3mGyEYCl7XYWbV9V6O`        | Youthful female — curious, spirited, quick |
| Thomas   | `GBv7mTt0atIp3Br8iCZE`        | Measured, mature male — wise elder, deliberate pacing, thoughtful |
| Dorothy  | `ThT5KcBeYPX3keUQqHPh`        | Airy, light female — ethereal, whimsical, gentle and dreamy |

---

## 2. Character Voice Profiling
_Used by: `src/lib/services/characterProfiler.ts` → `profileCharacters()` function_

### Full Prompt
```
You are a voice director for a children's audio drama. Study the script and cast each character
with a detailed voice profile.

Characters: {characterNames}

Script sample:
{first 30 blocks, character names and cleaned dialogue}

Available voices:
- "Adam":    deep, warm baritone male — authoritative, trustworthy narrator quality
- "Emily":   soft, gentle female — nurturing, calm, reassuring
- "Arnold":  strong, bold male — energetic, adventurous, determined
- "Rachel":  warm, expressive female — emotional, storyteller quality, heartfelt
- "Harry":   bright, playful young male — child-like, mischievous, light and bouncy
- "Elli":    youthful female — curious, spirited, quick
- "Thomas":  measured, mature male — wise elder, deliberate pacing, thoughtful
- "Dorothy": airy, light female — ethereal, whimsical, gentle and dreamy

For EACH character produce:
1. voiceName — choose from the list above (label name only, e.g. "Adam").
2. persona — exactly 1 sentence (max 20 words) for the TTS engine covering ONLY:
   pace (slow/measured/fast) + pitch (low/mid/high) + energy (calm/warm/bright/excited)
   Example: "Slow, low-pitched and warm — speak with quiet authority and gentle pauses."
   Example: "Fast, high-pitched and bright — speak with bubbly excitement and natural breathiness."
3. stability — a number 0.0–1.0:
   • 0.2–0.4 = highly expressive, variable (excited children, dramatic characters)
   • 0.5–0.6 = naturally expressive (most characters)
   • 0.7–0.9 = calm, consistent (narrators, wise elders, soothing characters)
4. style — a number 0.0–1.0:
   • 0.0–0.2 = understated, natural delivery
   • 0.3–0.5 = noticeable personality and colour
   • 0.6–0.8 = strong stylistic expression (comedic, highly dramatic)

Rules:
- Narrator uses "Adam" (or "Rachel" if narrator is female) with stability 0.75, style 0.1.
- Children use "Harry" (boys) or "Elli" (girls) with stability 0.3, style 0.5.
- Each character MUST get a different voice where possible.

Return ONLY valid JSON (all keys double-quoted), no markdown:
{ "CharacterName": { "voiceName": "Adam", "persona": "...", "stability": 0.7, "style": 0.1 }, ... }
```

### Model & Settings
- Model: `gemini-2.5-flash`, temperature 0.4, max 2048 tokens, responseMimeType: `application/json`
- Safety settings: BLOCK_ONLY_HIGH for all harm categories

### Fallback Profiles (when Gemini fails or character is missing)
| Pattern | Voice | Persona summary | Stability | Style |
|---------|-------|----------------|-----------|-------|
| `/narrator\|storyteller/` | Adam | Warm, unhurried storyteller with gentle authority and wonder | 0.75 | 0.1 |
| `/child\|kid\|little\|young/` | Harry | Lively, curious child — breathless, full of wonder, emotions show freely | 0.3 | 0.5 |
| _(all others)_ | Rachel | Warm, expressive character — natural delivery, emotion comes through | 0.55 | 0.25 |

### Post-processing
After Gemini responds, label names (e.g. `"Adam"`) are resolved to EL voice IDs via `labelToId` map.
Numeric `stability` and `style` fields are clamped to `[0, 1]`.

---

## 3. ElevenLabs TTS — Production
_Used by: `src/lib/services/ttsService.ts` → `synthesizeEL()` via `synthesizeLine()`_

### API Call
```
POST https://api.elevenlabs.io/v1/text-to-speech/{voiceId}?output_format=pcm_24000
xi-api-key: {ELEVENLABS_API_KEY}
Content-Type: application/json

{
  "text": "{spokenText — performance tags stripped}",
  "model_id": "eleven_multilingual_v2",
  "voice_settings": {
    "stability": {from character profile, default 0.5},
    "similarity_boost": 0.75,
    "style": {from character profile, default 0.3},
    "use_speaker_boost": true
  }
}
```

### Performance Tag Handling
- Tags like `[excited]`, `[whispering]`, `[warmly]` are stripped from text before TTS.
- When using Gemini TTS fallback, stripped tags are converted to a `styleHints` instruction
  (e.g. "Deliver this line with the following emotion/style: excited, whispering.") which
  is merged with the character's `persona` into the `systemInstruction`.

### ElevenLabs Voice Settings Reference
| Parameter | Range | Low value | High value |
|-----------|-------|-----------|------------|
| `stability` | 0–1 | More expressive, variable (excited children) | Consistent, calm (narrators) |
| `similarity_boost` | 0–1 | More creative | Closer to original voice | 
| `style` | 0–1 | Understated, natural | Highly dramatic / stylized |
| `use_speaker_boost` | bool | — | Enhances clarity and presence |

### Output Format
- ElevenLabs returns raw PCM (24000 Hz, 16-bit, mono) for `pcm_24000` format.
- Wrapped in WAV header (44 bytes) before writing to disk.
- Retry logic: up to 5 attempts; rate-limited (429) waits up to 30s; network errors retry with backoff.

---

## 4. Gemini TTS — Fallback
_Used by: `src/lib/services/ttsService.ts` → `synthesizeGemini()` when ElevenLabs unavailable_

### API Call
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key={GEMINI_API_KEY}

{
  "contents": [{ "role": "user", "parts": [{ "text": "{spokenText}" }] }],
  "generationConfig": {
    "responseModalities": ["AUDIO"],
    "speechConfig": {
      "voiceConfig": {
        "prebuiltVoiceConfig": { "voiceName": "{Gemini voice name}" }
      }
    }
  },
  "systemInstruction": { "parts": [{ "text": "{persona + styleHints}" }] }
}
```

### Gemini TTS Voice Pool (for preview only)
| Voice    | Character |
|----------|-----------|
| Aoede    | Warm, melodic, enchanting feminine |
| Charon   | Deep, gravelly, authoritative |
| Fenrir   | Strong, dynamic, expressive masculine |
| Kore     | Soft, warm, gentle feminine |
| Leda     | Clear, bright, lively feminine |
| Orus     | Steady, rich, deep masculine |
| Puck     | Playful, energetic, youthful |
| Zephyr   | Bright, airy, gentle neutral |

---

## 5. Voice Preview — Automatic Voice Picker
_Used by: `src/app/api/voices/preview/route.ts` → `pickGeminiVoice()` (type="text" requests)_

### Prompt
```
From these TTS voices, pick the ONE that best matches: "{description}"

Voices:
- Aoede: warm, melodic, enchanting feminine
- Charon: deep, gravelly, authoritative
- Fenrir: strong, dynamic, expressive masculine
- Kore: soft, warm, gentle feminine
- Leda: clear, bright, lively feminine
- Orus: steady, rich, deep masculine
- Puck: playful, energetic, youthful
- Zephyr: bright, airy, gentle neutral

Return ONLY the voice name. Nothing else.
```

### Model: `gemini-2.5-flash` (default settings)
- Valid values: `["Aoede", "Charon", "Fenrir", "Kore", "Leda", "Orus", "Puck", "Zephyr"]`
- Falls back to `"Aoede"` if response is not in the valid list.

---

## 6. SFX Generation
_Used by: `src/lib/services/sfxService.ts` via `src/app/api/produce-drama/route.ts`_

### API Call (ElevenLabs Sound Generation)
```
POST https://api.elevenlabs.io/v1/sound-generation
xi-api-key: {ELEVENLABS_API_KEY}
Content-Type: application/json

{
  "text": "{sfx description from drama planner}",
  "duration_seconds": {duration_hint_ms / 1000},
  "prompt_influence": 0.3
}
```

### SFX Descriptions
SFX descriptions come from the drama planner (Section 3 of script-generation.md).
They must be warm and child-friendly — 1–2 sentences describing the sound and its
gentle or cheerful emotional tone.

Examples of good SFX descriptions:
- `"a sunny garden with soft birdsong, a gentle breeze rustling leaves, and cheerful crickets — warm, peaceful and inviting"`
- `"soft wind chimes tinkling in a gentle breeze, magical and light, like fairy bells announcing something wonderful"`
- `"gentle waves lapping softly on a sandy shore, calm and rhythmic, like a lullaby from the sea"`
- `"a small wooden door creaking open slowly, filled with warm curiosity and gentle anticipation"`

### SFX Duration Guidelines (from drama planner)
| Type | Duration |
|------|----------|
| Ambient background loop | Up to 22s (looped to full story length) |
| Event SFX | 1500–4000ms |
| Single accent | 500–2000ms |

### Looping Behavior
- SFX tracks marked `loop: true` in the drama plan have their duration extended to
  `min(22000ms, totalDurationMs)` before sending to ElevenLabs.
- Non-looping tracks use `duration_hint_ms` from the drama plan, defaulting to 3000ms.
- If SFX generation fails, a WAV silence file of the requested duration is written instead.

---

## 7. ElevenLabs Voice Cloning (for user-recorded voices)
_Used by: `src/app/api/voices/preview/route.ts` (type="recorded" requests)_

### Clone API Call
```
POST https://api.elevenlabs.io/v1/voices/add
xi-api-key: {ELEVENLABS_API_KEY}
Content-Type: multipart/form-data

name: "{voice name}"
files: {audio recording (wav/webm/mp4)}
```

### TTS with Cloned Voice
```
POST https://api.elevenlabs.io/v1/text-to-speech/{cloned_voice_id}
xi-api-key: {ELEVENLABS_API_KEY}

{
  "text": "{sample text in selected language}",
  "model_id": "eleven_multilingual_v2",
  "voice_settings": { "stability": 0.5, "similarity_boost": 0.75 }
}
```

### Sample Texts by Language (for voice previews)
| Language | Sample |
|----------|--------|
| en | "This is me and I will be happy to join your story" |
| he | "זה אני, ואשמח להצטרף לסיפור שלך" |
| ar | "هذا أنا وسأكون سعيداً بالانضمام إلى قصتك" |
| fr | "C'est moi et je serai heureux de rejoindre ton histoire" |
| es | "Soy yo y estaré feliz de unirme a tu historia" |
| de | "Das bin ich und ich würde mich freuen, an deiner Geschichte teilzunehmen" |
| it | "Sono io e sarò felice di unirmi alla tua storia" |
| pt | "Sou eu e ficaria feliz em me juntar à sua história" |
| ru | "Это я, и я буду рад присоединиться к твоей истории" |
| zh | "这是我，我将很乐意加入你的故事" |
