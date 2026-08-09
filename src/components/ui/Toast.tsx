/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "./cn";

export type ToastTone = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  showToast: (tone: ToastTone, title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_ICON: Record<ToastTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const TONE_CLASSES: Record<ToastTone, string> = {
  success:
    "border-brand-green-600/30 bg-brand-green-50 dark:bg-brand-green-600/10 text-brand-green-600 dark:text-emerald-300 [&_.toast-icon]:text-brand-green-600 dark:[&_.toast-icon]:text-emerald-400",
  error:
    "border-brand-red-600/30 bg-brand-red-50 dark:bg-brand-red-600/10 text-brand-red-600 dark:text-red-300 [&_.toast-icon]:text-brand-red-600 dark:[&_.toast-icon]:text-red-400",
  warning:
    "border-brand-gold-600/40 bg-brand-gold-300/20 dark:bg-brand-gold-600/10 text-amber-800 dark:text-brand-gold-300 [&_.toast-icon]:text-amber-600 dark:[&_.toast-icon]:text-brand-gold-300",
  info: "border-brand-navy-700/25 bg-brand-blue-50 dark:bg-brand-navy-700/10 text-brand-navy-900 dark:text-blue-200 [&_.toast-icon]:text-brand-navy-700 dark:[&_.toast-icon]:text-blue-300",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (tone: ToastTone, title: string, description?: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, tone, title, description }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
          {toasts.map((toast) => {
            const Icon = TONE_ICON[toast.tone];
            return (
              <div
                key={toast.id}
                role="status"
                className={cn(
                  "pointer-events-auto flex items-start gap-2.5 rounded-xl border p-3.5 shadow-lg motion-safe:animate-[toastIn_180ms_ease-out] bg-surface dark:bg-surface-dark",
                  TONE_CLASSES[toast.tone],
                )}
              >
                <Icon className="toast-icon h-4.5 w-4.5 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-ink dark:text-ink-dark">{toast.title}</p>
                  {toast.description && (
                    <p className="text-[11px] text-ink-soft dark:text-ink-soft-dark mt-0.5 leading-relaxed">
                      {toast.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Fechar aviso"
                  onClick={() => dismiss(toast.id)}
                  className="shrink-0 text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast deve ser usado dentro de um <ToastProvider>.");
  }
  return context;
}
