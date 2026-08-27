import { useEffect, useState, type ReactNode } from "react";
import { getApi } from "../api";
import { cn } from "../lib/cn";
import { IconClose, IconMaximize, IconMinimize, IconRestore } from "./icons";

function ControlButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={
        danger
          ? "grid size-8 place-items-center text-accent transition-colors hover:bg-danger/20 hover:text-danger"
          : "grid size-8 place-items-center text-accent transition-colors hover:bg-accent/15 hover:text-accent"
      }
    >
      {children}
    </button>
  );
}

/** Mockup-style frameless window controls. */
export function WindowControls({ className }: { className?: string }) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let off = () => {};
    try {
      const api = getApi();
      void api.windowIsMaximized().then(setMaximized);
      off = api.onWindowMaximized(setMaximized);
    } catch {
      /* browser / no bridge */
    }
    return () => off();
  }, []);

  const run = (fn: () => Promise<unknown>) => {
    try {
      void fn();
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className={cn(
        "app-no-drag flex items-center border border-accent bg-bg0",
        className,
      )}
    >
      <ControlButton
        label="Minimize"
        onClick={() => run(() => getApi().windowMinimize())}
      >
        <IconMinimize className="size-4" />
      </ControlButton>
      <ControlButton
        label={maximized ? "Restore" : "Maximize"}
        onClick={() =>
          run(async () => {
            const next = await getApi().windowMaximize();
            setMaximized(next);
          })
        }
      >
        {maximized ? (
          <IconRestore className="size-4" />
        ) : (
          <IconMaximize className="size-4" />
        )}
      </ControlButton>
      <ControlButton
        label="Close"
        danger
        onClick={() => run(() => getApi().windowClose())}
      >
        <IconClose className="size-4" />
      </ControlButton>
    </div>
  );
}
