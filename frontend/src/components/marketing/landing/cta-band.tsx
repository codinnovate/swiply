export function CtaBand() {
  return (
    <section className="bg-[#F8FBFF] px-5 pb-7">
      <div className="relative mx-auto max-w-[1080px] overflow-hidden rounded-[34px] bg-[#0D0D0F] px-7 py-[clamp(44px,6vw,78px)] text-center text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(255,225,102,.36),transparent_26%),radial-gradient(circle_at_82%_18%,rgba(17,207,195,.34),transparent_26%),radial-gradient(circle_at_64%_88%,rgba(7,90,242,.44),transparent_30%)]" />
        <div className="absolute left-7 top-8 size-16 rounded-[24px] bg-[#FF6B35] animate-[swiply-float_5.8s_ease-in-out_infinite] motion-reduce:animate-none" />
        <div className="absolute bottom-10 right-8 size-20 rounded-full bg-[#FFE166] animate-[swiply-float_6.2s_ease-in-out_infinite] motion-reduce:animate-none" style={{ "--float-y": "16px" } as React.CSSProperties} />
        <div className="relative">
        <h2 className="m-0 text-balance font-display text-[clamp(36px,5.8vw,66px)] font-normal leading-[1.02] tracking-[-.015em] text-white">
          Your next 30 posts are
          <br />
          <span className="text-[#FFE166]">already in motion.</span>
        </h2>
        <p className="mx-auto mt-[18px] max-w-[460px] text-base font-medium leading-[1.55] text-white/65">
          Connect TikTok and Instagram, approve the first batch, and go back to building.
        </p>
        <div className="mt-[30px] flex flex-wrap justify-center gap-2.5">
          <a
            href="#top"
            className="rounded-full bg-[#FFE166] px-[30px] py-[15px] text-[15px] font-bold text-[#251900] shadow-[0_14px_30px_-14px_rgba(255,225,102,0.8)] transition-transform duration-200 hover:-translate-y-0.5"
          >
            Start free - no card
          </a>
          <a
            href="#how"
            className="rounded-full bg-white/10 px-[30px] py-[15px] text-[15px] font-bold text-white ring-1 ring-white/15 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-white/15"
          >
            See how it works
          </a>
        </div>
        </div>
      </div>
    </section>
  );
}
