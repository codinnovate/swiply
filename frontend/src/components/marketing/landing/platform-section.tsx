import { cn } from "@/lib/utils";
import { platformStats } from "./data";

function StatCard({ value, body, dark }: (typeof platformStats)[number]) {
  return (
    <div
      className={cn(
        "swiply-card-hover rounded-[24px] p-[26px]",
        dark ? "bg-[#0D0D0F] text-white" : "bg-white shadow-[0_14px_34px_-26px_rgba(20,45,80,0.5)]",
      )}
    >
      <div
        className={cn(
          "font-display text-[clamp(36px,4vw,50px)] font-normal tracking-[-.01em]",
          dark && "text-[#075AF2]",
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
    <section id="platforms" className="relative overflow-hidden bg-[#111318] px-5 pb-[88px] pt-24 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_20%,rgba(7,90,242,.45),transparent_28%),radial-gradient(circle_at_88%_12%,rgba(255,225,102,.32),transparent_24%),radial-gradient(circle_at_72%_86%,rgba(17,207,195,.25),transparent_30%)]" />
      <div className="absolute inset-0 dot-grid opacity-20" />
      <div className="relative mx-auto max-w-[1080px] text-center">
        <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[.14em] text-[#11CFC3]">
          <span className="block size-[7px] rounded-full bg-[#075AF2]" /> Two platforms. On purpose.
        </div>
        <h2 className="mx-auto mt-[26px] max-w-[900px] text-pretty font-display text-[clamp(31px,5vw,58px)] font-normal leading-[1.2] tracking-[-.012em] text-white/55">
          Everyone else posts <strong className="font-normal text-white">everywhere.</strong> Swiply posts image slideshows to{" "}
          <span className="mx-1 inline-flex items-center gap-2 align-middle">
            <span className="rounded-[.5em] bg-[#FFE166] px-[.7em] py-[.28em] text-[.62em] font-bold text-[#251900]">TikTok</span>
            <span className="rounded-[.5em] bg-[#FF6B35] px-[.7em] py-[.28em] text-[.62em] font-bold text-white">Instagram</span>
          </span>{" "}
          - the two feeds where static carousels still beat video on <strong className="font-normal text-white">cost per install.</strong>
        </h2>
      </div>

      <div className="relative mx-auto mt-14 grid max-w-[1080px] grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
        {platformStats.map((stat) => (
          <StatCard key={stat.value} {...stat} />
        ))}
      </div>
    </section>
  );
}
