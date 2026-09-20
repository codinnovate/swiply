import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:translate-y-px",
  { variants: { variant: {
    default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/85",
    outline: "border border-border bg-card hover:bg-muted",
    ghost: "hover:bg-muted hover:text-foreground",
    destructive: "bg-destructive text-white hover:bg-destructive/90",
    link: "text-primary underline-offset-4 hover:underline",
  }, size: { default: "h-10 px-4", sm: "h-8 rounded-lg px-3 text-xs", lg: "h-12 px-6 text-base", icon: "size-10 p-0" } }, defaultVariants: { variant: "default", size: "default" } },
);

export function Button({ className, variant, size, asChild = false, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
