import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getApi } from "../api";

export type RommConnectionStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "ok"; platforms: number }
  | { state: "error"; error: string };

type RommConnectionContextValue = {
  status: RommConnectionStatus;
  checkConnection: () => Promise<RommConnectionStatus>;
};

const RommConnectionContext = createContext<RommConnectionContextValue | null>(
  null,
);

export function useRommConnection(): RommConnectionContextValue {
  const ctx = useContext(RommConnectionContext);
  if (!ctx) {
    throw new Error(
      "useRommConnection must be used within RommConnectionProvider",
    );
  }
  return ctx;
}

async function runConnectionCheck(): Promise<RommConnectionStatus> {
  const cfg = await getApi().getConfig();
  if (!cfg.romm.baseUrl.trim() || !cfg.romm.apiToken.trim()) {
    return { state: "idle" };
  }

  try {
    const result = await getApi().testConnection();
    if (result.ok) {
      return { state: "ok", platforms: result.platforms ?? 0 };
    }
    return {
      state: "error",
      error: result.error ?? "Connection failed",
    };
  } catch (e) {
    return {
      state: "error",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export function RommConnectionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<RommConnectionStatus>({
    state: "checking",
  });

  const checkConnection = useCallback(async () => {
    setStatus({ state: "checking" });
    const next = await runConnectionCheck();
    setStatus(next);
    return next;
  }, []);

  useEffect(() => {
    void checkConnection();
  }, [checkConnection]);

  const value = useMemo(
    () => ({ status, checkConnection }),
    [status, checkConnection],
  );

  return (
    <RommConnectionContext.Provider value={value}>
      {children}
    </RommConnectionContext.Provider>
  );
}
