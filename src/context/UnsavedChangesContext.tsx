"use client";

import { createContext, useContext, useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface UnsavedChangesContextValue {
  /** Register (or clear) a navigation guard. Call again whenever the dirty state changes. */
  setGuard: (active: boolean, message: string) => void;
  /** Navigate to href, showing the confirm modal first if a guard is active. */
  guardedNavigate: (href: string) => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // Ref, not state — this updates on every keystroke-driven dirty check in the
  // registering page, and only needs to be read once, at the moment of a nav click.
  const guardRef = useRef<{ active: boolean; message: string }>({ active: false, message: "" });
  const [modal, setModal] = useState<{ open: boolean; message: string; href: string | null }>({
    open: false, message: "", href: null,
  });

  const setGuard = useCallback((active: boolean, message: string) => {
    guardRef.current = { active, message };
  }, []);

  const guardedNavigate = useCallback((href: string) => {
    if (guardRef.current.active) {
      setModal({ open: true, message: guardRef.current.message, href });
    } else {
      router.push(href);
    }
  }, [router]);

  const confirmLeave = useCallback(() => {
    const href = modal.href;
    setModal({ open: false, message: "", href: null });
    if (href) router.push(href);
  }, [modal.href, router]);

  return (
    <UnsavedChangesContext.Provider value={{ setGuard, guardedNavigate }}>
      {children}
      {modal.open && (
        <div
          className="fixed inset-0 flex items-center justify-center px-6"
          style={{ zIndex: 999, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-4"
            style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
          >
            <p className="text-white/85 text-fs-body leading-relaxed">{modal.message}</p>
            <button
              onClick={confirmLeave}
              className="self-end px-5 py-2 rounded-full font-semibold text-fs-body transition-all active:scale-95"
              style={{ background: "rgba(79,195,247,0.15)", border: "1px solid rgba(79,195,247,0.4)", color: "#4fc3f7" }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) throw new Error("useUnsavedChanges must be used within UnsavedChangesProvider");
  return ctx;
}
