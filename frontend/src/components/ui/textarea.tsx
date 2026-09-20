import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn("min-h-28 w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50", className)} {...props} />;
}
