import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return <Link href="/" className={cn("inline-flex items-center gap-2.5 font-display text-xl font-normal", className)}><Image src="/brand/swiply-logo-icon-transparent.png" alt="" width={36} height={36} className="size-9 rounded-xl" />{!compact && <span>Swiply</span>}</Link>;
}
