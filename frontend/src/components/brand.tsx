import Link from "next/link";
import { cn } from "@/lib/utils";

export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return <Link href="/" className={cn("inline-flex items-center gap-2.5 font-display text-xl font-semibold", className)}><span className="relative grid size-9 place-items-center overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-sm"><svg viewBox="0 0 36 36" className="size-7" aria-hidden><path d="M7 10c4-4 15-4 20 1-6-1-11 1-12 4 6-1 11 1 13 6-5 7-18 7-22 0 6 2 11 1 14-2-6 0-12-3-13-9Z" fill="currentColor" /></svg><span className="absolute right-1 top-1 size-1.5 rounded-full bg-secondary" /></span>{!compact && <span>Swiply</span>}</Link>;
}
