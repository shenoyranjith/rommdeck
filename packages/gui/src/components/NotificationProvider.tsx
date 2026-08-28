import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "../lib/cn";

export type NotificationTone = "ok" | "err";

interface Notification {
  message: string;
  tone: NotificationTone;
}

type NotificationActions = {
  notifyOk: (message: string) => void;
  notifyError: (message: string) => void;
  clearNotification: () => void;
};

const DISMISS_MS: Record<NotificationTone, number> = {
  ok: 3500,
  err: 5500,
};

const NotificationActionsContext =
  createContext<NotificationActions | null>(null);

const NotificationStateContext = createContext<Notification | null>(null);

export function useNotification(): NotificationActions {
  const ctx = useContext(NotificationActionsContext);
  if (!ctx) {
    throw new Error("useNotification must be used within NotificationProvider");
  }
  return ctx;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<Notification | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const clearNotification = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setNotification(null);
  }, []);

  const show = useCallback((message: string, tone: NotificationTone) => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setNotification({ message, tone });
    dismissTimer.current = setTimeout(() => {
      setNotification(null);
    }, DISMISS_MS[tone]);
  }, []);

  const notifyOk = useCallback(
    (message: string) => show(message, "ok"),
    [show],
  );

  const notifyError = useCallback(
    (message: string) => show(message, "err"),
    [show],
  );

  useEffect(
    () => () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    },
    [],
  );

  const actions = useMemo(
    () => ({ notifyOk, notifyError, clearNotification }),
    [notifyOk, notifyError, clearNotification],
  );

  return (
    <NotificationActionsContext.Provider value={actions}>
      <NotificationStateContext.Provider value={notification}>
        {children}
      </NotificationStateContext.Provider>
    </NotificationActionsContext.Provider>
  );
}

/** Overlays the active notification above the status bar without shifting main content. */
export function NotificationAnchor() {
  const notification = useContext(NotificationStateContext);
  const { clearNotification } = useNotification();
  if (!notification) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      title="Click to dismiss"
      onClick={() => clearNotification()}
      className={cn(
        "absolute inset-x-0 bottom-full z-30 mb-2 cursor-pointer border px-3 py-2 text-sm transition-opacity hover:opacity-90",
        notification.tone === "ok"
          ? "border-ok/40 bg-bg2 text-ok"
          : "border-danger/40 bg-bg2 text-danger",
      )}
    >
      {notification.message}
    </div>
  );
}
