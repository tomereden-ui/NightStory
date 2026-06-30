import { Suspense } from "react";
import SetPasswordPageInner from "./SetPasswordPageInner";

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordPageInner />
    </Suspense>
  );
}
