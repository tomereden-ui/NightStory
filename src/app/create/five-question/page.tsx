"use client";
import { useState } from "react";
import { FiveQuestionFlow, DRAFT_KEY } from "./FiveQuestionFlow";

export default function FiveQuestionPage() {
  // Every visit here means "start a fresh SBS story" — there's no resume
  // affordance on this standalone route — so clear any draft left over from
  // a previously abandoned attempt before FiveQuestionFlow's own mount-time
  // restore effect can read it. The lazy useState initializer runs exactly
  // once per real mount, never on re-renders.
  useState(() => {
    if (typeof window !== "undefined") {
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    }
  });
  return <FiveQuestionFlow />;
}
