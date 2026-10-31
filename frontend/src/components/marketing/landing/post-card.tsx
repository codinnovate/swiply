import { cn } from "@/lib/utils";
import type { ReelPost } from "./data";

export function PostCard({ platform, slideIndex, hook, dark = false }: ReelPost & { dark?: boolean }) {
  const accent = platform === "TikTok" ? "#11CFC3" : "#FF6B35";

  return (
    <div
      className={cn(
        "group flex aspect-[9/16] w-[216px] flex-none flex-col overflow-hidden rounded-[22px] shadow-[0_22px_44px_-26px_rgba(20,45,80,0.7)] transition-transform duration-300 hover:-translate-y-2",
        dark ? "bg-[#0D0D0F]" : "bg-white",
      )}
    >
      <div
        className={cn(
          "relative flex min-h-0 flex-1 items-start justify-between overflow-hidden p-2.5",
          dark
            ? "bg-[#16181F]"
            : "bg-[#EEF5FF]",
        )}
      >
        <div className="absolute inset-0 opacity-90" style={{ background: `radial-gradient(circle at 28% 22%, ${accent}66, transparent 34%), radial-gradient(circle at 78% 72%, #FFE16688, transparent 30%)` }} />
        <div className="absolute bottom-5 left-5 right-5 rounded-[20px] bg-white/90 p-3 shadow-[0_18px_34px_-26px_rgba(13,13,15,.85)] transition-transform duration-300 group-hover:-translate-y-1">
          <div className="aspect-[4/3] rounded-[16px] p-3 text-white" style={{ backgroundColor: accent }}>
            <span className="rounded-full bg-white/22 px-2 py-1 text-[8px] font-black uppercase tracking-[.12em]">Product</span>
            <span className="mt-12 block h-2 w-24 rounded-full bg-white/80" />
            <span className="mt-2 block h-2 w-16 rounded-full bg-white/50" />
          </div>
        </div>
        <span
          className={cn(
            "relative rounded-md px-2 py-1 text-[9.5px] font-semibold tracking-[.06em] text-white",
            dark ? "bg-white/12" : "bg-[#0D0D0F]/78",
          )}
        >
          {platform}
        </span>
        <span className={cn("relative rounded-md px-[7px] py-1 text-[9.5px] font-semibold text-white", dark ? "bg-white/12" : "bg-[#0D0D0F]/78")}>
          {slideIndex}
        </span>
      </div>
      <div className="flex flex-col gap-3 px-3.5 pb-4 pt-3.5">
        <div
          className={cn(
            "font-display text-[20px] leading-[1.1] tracking-[-.005em]",
            dark ? "text-white" : "text-[#0D0D0F]",
          )}
        >
          {hook}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <span className="block h-[5px] w-[14px] rounded-full bg-[#075AF2]" />
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} className={cn("block size-[5px] rounded-full", dark ? "bg-[#2E3138]" : "bg-[#DCE3EB]")} />
            ))}
          </div>
          <span className="text-[9.5px] font-semibold tracking-[.08em] text-[#075AF2]">AUTO-POSTED</span>
        </div>
      </div>
    </div>
  );
}
