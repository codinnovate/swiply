import type { ReactNode } from "react";

import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";

export const LEGAL_OWNER = "Samuel Adeyemi";
export const LEGAL_EMAIL = "adeyemis710@gmail.com";
export const LEGAL_LAST_UPDATED = "October 2, 2026";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <MarketingHeader />
      <main className="px-5 py-24">
        <article className="mx-auto max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[.2em] text-primary">Legal</p>
          <h1 className="mt-4 font-display text-5xl font-semibold leading-tight">{title}</h1>
          <p className="mt-4 text-sm text-muted-foreground">Last updated {LEGAL_LAST_UPDATED}</p>
          <div className="mt-12 space-y-10 text-base leading-7 text-muted-foreground">{children}</div>
        </article>
      </main>
      <MarketingFooter />
    </>
  );
}

export function LegalSection({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="space-y-3">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function ContactLink() {
  return (
    <a href={`mailto:${LEGAL_EMAIL}`} className="font-medium text-foreground underline underline-offset-4">
      {LEGAL_EMAIL}
    </a>
  );
}
