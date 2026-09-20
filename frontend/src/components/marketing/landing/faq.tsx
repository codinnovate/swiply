"use client";

import { useState } from "react";
import { faqs } from "./data";

export function Faq() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="px-5 pb-24">
      <div className="mx-auto max-w-[760px]">
        <h2 className="m-0 mb-[22px] font-[family-name:var(--font-landing-serif)] text-[clamp(30px,3.8vw,42px)] font-normal leading-[1.1] tracking-[-.012em] text-[#0D0D0F]">
          Questions founders ask
        </h2>
        {faqs.map((faq, i) => {
          const open = openIndex === i;
          return (
            <div key={faq.q} className="mb-2 rounded-2xl bg-white px-[22px] py-5 shadow-[0_12px_30px_-26px_rgba(20,45,80,0.5)]">
              <button
                type="button"
                onClick={() => setOpenIndex(open ? -1 : i)}
                aria-expanded={open}
                className="flex w-full cursor-pointer items-center justify-between gap-4 border-0 bg-transparent p-0 text-left"
              >
                <span className="text-base font-bold tracking-[-.01em] text-[#0D0D0F]">{faq.q}</span>
                <span className="text-xl font-bold leading-none text-[#FF5A1F]">{open ? "–" : "+"}</span>
              </button>
              {open && (
                <p className="m-0 mt-3 max-w-[620px] text-[14.5px] font-medium leading-[1.65] text-[#59636E]">{faq.a}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
