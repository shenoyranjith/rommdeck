import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getApi } from "../api";
import { ConfirmDialog, type ConfirmDialogProps } from "./ConfirmDialog";

export type ConfirmOptions = Pick<
  ConfirmDialogProps,
  "title" | "message" | "hint" | "detail" | "confirmLabel" | "cancelLabel" | "tone"
>;

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm(): ConfirmContextValue["confirm"] {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return ctx.confirm;
}

function formatQuitDetail(payload: {
  downloading: number;
  queued: number;
  metadata: number;
  gamelistWriteActive: boolean;
}): string {
  const lines: string[] = [];
  if (payload.downloading > 0) lines.push(`${payload.downloading} downloading`);
  if (payload.queued > 0) lines.push(`${payload.queued} queued`);
  if (payload.metadata > 0) lines.push(`${payload.metadata} writing metadata`);
  if (payload.gamelistWriteActive) lines.push("gamelist.xml write in progress");
  const summary = lines.length > 0 ? lines.join(" · ") : "transfers in progress";
  return `${summary}\n\nQuit anyway? ROM files already on disk are kept. Incomplete downloads and metadata may need to be retried.`;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<ConfirmOptions | null>(null);
  const [quitDialog, setQuitDialog] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setDialog(options);
    });
  }, []);

  const close = (result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setDialog(null);
  };

  useEffect(() => {
    try {
      return getApi().onQuitConfirm((payload) => {
        setQuitDialog({
          title: "Active transfers",
          message: "RommDeck still has work in progress.",
          detail: formatQuitDetail(payload),
          confirmLabel: "Quit anyway",
          cancelLabel: "Stay",
          tone: "warning",
        });
      });
    } catch {
      return () => {};
    }
  }, []);

  const closeQuit = (confirmed: boolean) => {
    setQuitDialog(null);
    void getApi().respondQuitConfirm(confirmed);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {dialog && (
        <ConfirmDialog
          {...dialog}
          onCancel={() => close(false)}
          onConfirm={() => close(true)}
        />
      )}
      {quitDialog && (
        <ConfirmDialog
          {...quitDialog}
          onCancel={() => closeQuit(false)}
          onConfirm={() => closeQuit(true)}
        />
      )}
    </ConfirmContext.Provider>
  );
}
