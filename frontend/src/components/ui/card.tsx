import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("rounded-2xl border border-border/80 bg-card text-card-foreground shadow-[0_1px_2px_rgba(36,24,44,.03),0_12px_32px_rgba(36,24,44,.04)]", className)} {...props} />; }
export function CardHeader({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("flex flex-col gap-1.5 p-5 pb-3", className)} {...props} />; }
export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) { return <h3 className={cn("font-display text-lg font-semibold", className)} {...props} />; }
export function CardDescription({ className, ...props }: React.ComponentProps<"p">) { return <p className={cn("text-sm text-muted-foreground", className)} {...props} />; }
export function CardContent({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("p-5 pt-2", className)} {...props} />; }
export function CardFooter({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("flex items-center p-5 pt-2", className)} {...props} />; }
