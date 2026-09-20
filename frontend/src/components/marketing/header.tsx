import Link from "next/link";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

export function MarketingHeader() { return <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5"><Brand /><nav className="hidden items-center gap-7 text-sm font-medium md:flex"><Link href="/#features">Features</Link><Link href="/pricing">Pricing</Link><Link href="/security">Security</Link><Link href="/docs">Docs</Link></nav><div className="flex items-center gap-2"><Button asChild variant="ghost" size="sm"><Link href="/login">Log in</Link></Button><Button asChild size="sm"><Link href="/register">Start creating</Link></Button></div></div></header>; }
