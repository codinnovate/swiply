import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  type,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm shadow-[0_1px_2px_rgba(36,24,44,.04)] outline-none transition",
        "placeholder:text-muted-foreground",
        "hover:border-primary/40",
        "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
        "file:mr-3 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        type === "number" &&
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        className,
      )}
      {...props}
    />
  );
}
