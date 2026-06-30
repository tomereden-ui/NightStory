import { Suspense } from "react";
import JoinPageInner from "./JoinPageInner";

export default function JoinPage() {
  return (
    <Suspense>
      <JoinPageInner />
    </Suspense>
  );
}
