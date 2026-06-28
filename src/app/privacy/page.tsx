"use client";

import { useRouter } from "next/navigation";

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <div
      className="min-h-screen px-6 py-10"
      style={{ background: "linear-gradient(160deg, #040612 0%, #0d0f22 60%, #080b18 100%)" }}
    >
      <div className="mx-auto max-w-2xl">
        <button
          onClick={() => router.back()}
          className="mb-8 flex items-center gap-2"
          style={{ color: "#a78bfa", fontSize: 14 }}
        >
          ← Back
        </button>

        <h1 className="font-bold mb-2" style={{ fontSize: 28, color: "#e2e8f0" }}>Privacy Policy</h1>
        <p style={{ fontSize: 13, color: "rgba(148,163,184,0.5)" }}>Last updated: June 2026</p>

        <div className="mt-8 flex flex-col gap-8" style={{ color: "rgba(203,213,225,0.85)", fontSize: 15, lineHeight: 1.7 }}>

          <section>
            <h2 style={{ fontSize: 18, color: "#e2e8f0", fontWeight: 600, marginBottom: 8 }}>1. Who we are</h2>
            <p>NightStory is a family bedtime story application. Parents create AI-generated personalised audio stories for their children. We take privacy — especially children's privacy — very seriously.</p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, color: "#e2e8f0", fontWeight: 600, marginBottom: 8 }}>2. What data we collect</h2>
            <ul className="flex flex-col gap-2" style={{ paddingLeft: 20, listStyleType: "disc" }}>
              <li><strong style={{ color: "#e2e8f0" }}>Parent account:</strong> Email address, authentication credentials.</li>
              <li><strong style={{ color: "#e2e8f0" }}>Child profiles:</strong> First name, age range, avatar — entered by the parent.</li>
              <li><strong style={{ color: "#e2e8f0" }}>Story preferences:</strong> Characters, settings, and themes chosen during story creation.</li>
              <li><strong style={{ color: "#e2e8f0" }}>Listening history:</strong> Which stories were played and progress through them.</li>
              <li><strong style={{ color: "#e2e8f0" }}>Voice recordings (optional):</strong> If you clone a voice, the recording is processed to create a voice model. This is biometric data and is stored securely. You can delete it at any time.</li>
              <li><strong style={{ color: "#e2e8f0" }}>Usage data:</strong> API call counts for internal cost tracking. Not sold or shared.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: 18, color: "#e2e8f0", fontWeight: 600, marginBottom: 8 }}>3. Children's privacy (COPPA &amp; GDPR)</h2>
            <p>NightStory is designed for parents to use on behalf of their children. Children do not directly interact with or create accounts on our platform.</p>
            <ul className="flex flex-col gap-2 mt-3" style={{ paddingLeft: 20, listStyleType: "disc" }}>
              <li>All child data is stored under the parent's authenticated account.</li>
              <li>We do not knowingly collect data directly from children under 13 (US) or 16 (EU).</li>
              <li>We do not sell or share children's data with third parties for advertising.</li>
              <li>By creating a child profile, you confirm you are the parent or legal guardian of that child and consent to data collection on their behalf.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: 18, color: "#e2e8f0", fontWeight: 600, marginBottom: 8 }}>4. How we use your data</h2>
            <ul className="flex flex-col gap-2" style={{ paddingLeft: 20, listStyleType: "disc" }}>
              <li>To generate personalised stories using AI (Gemini, ElevenLabs).</li>
              <li>To store and play back your stories.</li>
              <li>To manage your family account and shared access.</li>
              <li>We do not use your data for advertising or sell it to third parties.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: 18, color: "#e2e8f0", fontWeight: 600, marginBottom: 8 }}>5. Third-party services</h2>
            <ul className="flex flex-col gap-2" style={{ paddingLeft: 20, listStyleType: "disc" }}>
              <li><strong style={{ color: "#e2e8f0" }}>Supabase</strong> — database and file storage (EU/US data centres).</li>
              <li><strong style={{ color: "#e2e8f0" }}>Google Gemini</strong> — AI story and image generation. Story prompts may be sent to Google's servers.</li>
              <li><strong style={{ color: "#e2e8f0" }}>ElevenLabs</strong> — text-to-speech and voice cloning. Audio is processed on ElevenLabs servers.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: 18, color: "#e2e8f0", fontWeight: 600, marginBottom: 8 }}>6. Your rights</h2>
            <p>Under GDPR and COPPA you have the right to:</p>
            <ul className="flex flex-col gap-2 mt-3" style={{ paddingLeft: 20, listStyleType: "disc" }}>
              <li>Access all data we hold about you and your children.</li>
              <li>Correct inaccurate data.</li>
              <li>Delete your account and all associated data (available in Profile → Delete Account).</li>
              <li>Withdraw consent at any time by deleting your account.</li>
              <li>Port your data — contact us for an export.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: 18, color: "#e2e8f0", fontWeight: 600, marginBottom: 8 }}>7. Data retention</h2>
            <p>Your data is retained as long as your account is active. Deleted stories are kept in the trash for 30 days before permanent deletion. Deleting your account permanently removes all data within 30 days.</p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, color: "#e2e8f0", fontWeight: 600, marginBottom: 8 }}>8. Contact</h2>
            <p>Questions about this policy or your data? Contact us at <span style={{ color: "#a78bfa" }}>privacy@nightstory.app</span></p>
          </section>

        </div>

        <div className="mt-10 pb-10 flex justify-center">
          <button
            onClick={() => router.back()}
            className="rounded-xl px-6 py-3 font-semibold"
            style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)", fontSize: 14 }}
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}
