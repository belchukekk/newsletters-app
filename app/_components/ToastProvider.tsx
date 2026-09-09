"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type ToastVariant = "success" | "error";
type Toast = { id: number; message: string; variant: ToastVariant };

const ToastContext = createContext<((message: string, variant?: ToastVariant) => void) | null>(null);

const AUTO_DISMISS_MS = 4000;

// A minimal, dependency-free toast — used to confirm a subscribe/unsubscribe
// action succeeded (or explain why it didn't), since the toggle itself only
// shows current state, not "your last click worked." Mounted once in the
// root layout so any page (grid cards, /manage, /subscribe) can call
// useToast() without its own provider.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, variant }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.variant}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const showToast = useContext(ToastContext);
  if (!showToast) throw new Error("useToast must be used within a ToastProvider");
  return showToast;
}
