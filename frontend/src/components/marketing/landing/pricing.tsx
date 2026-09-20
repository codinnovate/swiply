"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { priceCards, type PriceCardData } from "./data";

function BillingToggle({ annual, onChange }: { annual: boolean; onChange: (annual: boolean) => void }) {
  const tabClass = (on: boolean) =>
    cn(
      "rounded-full px-5 py-2.5 text-sm font-bold transition-all duration-[.18s] ease-in-out",
      on ? "bg-[#0D0D0F] text-white" : "bg-transparent text-[#59636E]",
    );

  return (
    <div className="mt-[26px] inline-flex items-center gap-1 rounded-full bg-[#E9EEF4] p-1">
      <button type="button" onClick={() => onChange(false)} className={tabClass(!annual)}>
        Monthly
      </button>
      <button type="button" onClick={() => onChange(true)} className={tabClass(annual)}>
        Annual · save 20%
      </button>
    </div>
  );
}

function PriceCard({ card, annual }: { card: PriceCardData; annual: boolean }) {
  const price = annual ? card.annual : card.monthly;

  return (
    <div
      className={cn(
        "flex flex-col rounded-[22px] px-[30px] py-[34px]",
        card.featured
          ? "min-h-[620px] bg-[#0D0D0F] text-white shadow-[0_28px_56px_-30px_rgba(13,13,15,0.75)]"
          : "min-h-[560px] bg-white shadow-[0_14px_34px_-26px_rgba(20,45,80,0.5)]",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-[15px] font-bold">{card.name}</div>
        {card.featured && (
          <span className="rounded-full bg-[#FF5A1F] px-2.5 py-[5px] text-[10.5px] font-semibold tracking-[.1em] text-white">POPULAR</span>
        )}
      </div>
      <div className="mt-3.5 flex items-baseline gap-1.5">
        <span
          className={cn(
            "font-[family-name:var(--font-landing-serif)] text-[54px] font-normal tracking-[-.01em]",
            card.featured && "text-[#FF5A1F]",
          )}
        >
          {price}
        </span>
        <span className={cn("text-sm font-semibold", card.featured ? "text-[#9AA3AD]" : "text-[#7C8793]")}>/mo</span>
      </div>
      <p className={cn("mt-2.5 text-sm font-medium", card.featured ? "text-[#9AA3AD]" : "text-[#59636E]")}>{card.blurb}</p>
      <div
        className={cn(
          "mb-auto mt-6 flex flex-col gap-3 border-t pt-[22px]",
          card.featured ? "border-[#26282D]" : "border-[#EDF1F5]",
        )}
      >
        {card.features.map((feature) => (
          <div key={feature} className="flex items-start gap-2.5">
            <span
              className={cn(
                "mt-px flex size-4 flex-none items-center justify-center rounded-full text-[10px] font-bold text-[#FF5A1F]",
                card.featured ? "bg-[#FF5A1F]/18" : "bg-[#FFF0E9]",
              )}
            >
              ✓
            </span>
            <span className={cn("text-[13.5px] font-medium leading-[1.45]", card.featured ? "text-[#C9CCD1]" : "text-[#44505E]")}>
              {feature}
            </span>
          </div>
        ))}
      </div>
      <a
        href="#top"
        className={cn(
          "mt-7 block rounded-full py-[13px] text-center text-[14.5px] font-bold transition-colors",
          card.featured ? "bg-[#FF5A1F] text-white hover:bg-[#FF6F3C]" : "bg-[#F2F5F8] text-[#0D0D0F] hover:bg-[#E6EBF1]",
        )}
      >
        {card.ctaLabel}
      </a>
    </div>
  );
}

export function Pricing() {
  const [annual, setAnnual] = useState(true);

  return (
    <section id="pricing" className="px-5 pb-24">
      <div className="mx-auto max-w-[1080px]">
        <div className="text-center">
          <h2 className="m-0 font-[family-name:var(--font-landing-serif)] text-[clamp(34px,4.8vw,54px)] font-normal leading-[1.05] tracking-[-.015em] text-[#0D0D0F]">
            Cheaper than one freelance designer.
          </h2>
          <BillingToggle annual={annual} onChange={setAnnual} />
        </div>

        <div className="mt-9 grid grid-cols-[repeat(auto-fit,minmax(270px,1fr))] items-start gap-3.5">
          {priceCards.map((card) => (
            <PriceCard key={card.name} card={card} annual={annual} />
          ))}
        </div>
      </div>
    </section>
  );
}
