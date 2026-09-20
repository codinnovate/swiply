import { cn } from "@/lib/utils";
import type { ReelPost } from "./data";

export function PostCard({ platform, slideIndex, hook, dark = false }: ReelPost & { dark?: boolean }) {
  return (
    <div
      className={cn(
        "flex aspect-[9/16] w-[216px] flex-none flex-col overflow-hidden rounded-[18px] shadow-[0_22px_44px_-26px_rgba(20,45,80,0.7)]",
        dark ? "bg-[#0D0D0F]" : "bg-white",
      )}
    >
      <div
        className={cn(
          "relative flex min-h-0 flex-1 items-start justify-between p-2.5",
          dark
            ? "bg-[repeating-linear-gradient(135deg,#191A1F_0_9px,#212329_9px_18px)]"
            : "bg-[repeating-linear-gradient(135deg,#EDF2F7_0_9px,#E2E9F1_9px_18px)]",
        )}
      >
        <span
          className={cn(
            "rounded-md px-2 py-1 text-[9.5px] font-semibold tracking-[.06em] text-white",
            dark ? "bg-white/12" : "bg-[#0D0D0F]/78",
          )}
        >
          {platform}
        </span>
        <span className={cn("rounded-md px-[7px] py-1 text-[9.5px] font-semibold text-white", dark ? "bg-white/12" : "bg-[#0D0D0F]/78")}>
          {slideIndex}
        </span>
        <span
          className={cn(
            "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg px-[9px] py-1.5 text-[10px]",
            dark ? "bg-[#0D0D0F]/55 text-[#7C8793]" : "bg-white/80 text-[#5A6470]",
          )}
        >
          product shot 9:16
        </span>
      </div>
      <div className="flex flex-col gap-3 px-3.5 pb-4 pt-3.5">
        <div
          className={cn(
            "font-[family-name:var(--font-landing-serif)] text-[20px] leading-[1.1] tracking-[-.005em]",
            dark ? "text-white" : "text-[#0D0D0F]",
          )}
        >
          {hook}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <span className="block h-[5px] w-[14px] rounded-full bg-[#FF5A1F]" />
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} className={cn("block size-[5px] rounded-full", dark ? "bg-[#2E3138]" : "bg-[#DCE3EB]")} />
            ))}
          </div>
          <span className="text-[9.5px] font-semibold tracking-[.08em] text-[#FF5A1F]">AUTO-POSTED</span>
        </div>
      </div>
    </div>
  );
}
