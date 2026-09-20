import { cn } from "@/lib/utils";
import { platformStats } from "./data";

function StatCard({ value, body, dark }: (typeof platformStats)[number]) {
  return (
    <div
      className={cn(
        "rounded-[18px] p-[26px]",
        dark ? "bg-[#0D0D0F] text-white" : "bg-white shadow-[0_14px_34px_-26px_rgba(20,45,80,0.5)]",
      )}
    >
      <div
        className={cn(
          "font-[family-name:var(--font-landing-serif)] text-[clamp(36px,4vw,50px)] font-normal tracking-[-.01em]",
          dark && "text-[#FF5A1F]",
        )}
      >
        {value}
      </div>
      <div className={cn("mt-2 text-[14.5px] font-medium leading-[1.5]", dark ? "text-[#9AA3AD]" : "text-[#59636E]")}>{body}</div>
    </div>
  );
}

export function PlatformSection() {
  return (
    <section id="platforms" className="bg-[#F6F9FC] px-5 pb-[88px] pt-24">
      <div className="mx-auto max-w-[1080px] text-center">
        <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[.14em] text-[#FF5A1F]">
          <span className="block size-[7px] rounded-full bg-[#FF5A1F]" /> Two platforms. On purpose.
        </div>
        <h2 className="mx-auto mt-[26px] max-w-[900px] text-pretty font-[family-name:var(--font-landing-serif)] text-[clamp(31px,5vw,58px)] font-normal leading-[1.2] tracking-[-.012em] text-[#7B848E]">
          Everyone else posts <strong className="font-normal text-[#0D0D0F]">everywhere.</strong> Swiply posts image slideshows to{" "}
          <span className="mx-1 inline-flex items-center gap-2 align-middle">
            <span className="rounded-[.5em] bg-[#0D0D0F] px-[.7em] py-[.28em] text-[.62em] font-bold text-white">TikTok</span>
            <span className="rounded-[.5em] bg-[#0D0D0F] px-[.7em] py-[.28em] text-[.62em] font-bold text-white">Instagram</span>
          </span>{" "}
          — the two feeds where static carousels still beat video on <strong className="font-normal text-[#0D0D0F]">cost per install.</strong>
        </h2>
      </div>

      <div className="mx-auto mt-14 grid max-w-[1080px] grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
        {platformStats.map((stat) => (
          <StatCard key={stat.value} {...stat} />
        ))}
      </div>
    </section>
  );
}
