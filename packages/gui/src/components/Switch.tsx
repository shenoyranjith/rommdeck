import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "../lib/cn";

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  id,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center border border-line bg-bg0 transition-colors",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent/20",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "block size-4 translate-x-0.5 border border-line bg-bg2 transition-transform will-change-transform",
          "data-[state=checked]:translate-x-[1.35rem] data-[state=checked]:border-accent data-[state=checked]:bg-accent",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
