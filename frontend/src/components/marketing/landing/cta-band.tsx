export function CtaBand() {
  return (
    <section className="px-5 pb-7">
      <div className="mx-auto max-w-[1080px] rounded-[28px] bg-[linear-gradient(180deg,#CBE4FA_0%,#E6F1FB_100%)] px-7 py-[clamp(40px,6vw,72px)] text-center">
        <h2 className="m-0 text-balance font-[family-name:var(--font-landing-serif)] text-[clamp(36px,5.8vw,66px)] font-normal leading-[1.02] tracking-[-.015em] text-[#0D0D0F]">
          Your next 30 posts are
          <br />
          <span className="text-[#FF5A1F]">already written.</span>
        </h2>
        <p className="mx-auto mt-[18px] max-w-[460px] text-base font-medium leading-[1.55] text-[#44505E]">
          Connect TikTok and Instagram, approve the first batch, and go back to building.
        </p>
        <div className="mt-[30px] flex flex-wrap justify-center gap-2.5">
          <a
            href="#top"
            className="rounded-full bg-[#FF5A1F] px-[30px] py-[15px] text-[15px] font-bold text-white shadow-[0_14px_30px_-10px_rgba(255,90,31,0.7)] transition-colors hover:bg-[#FF6F3C]"
          >
            Start free — no card
          </a>
          <a
            href="#how"
            className="rounded-full bg-white/80 px-[30px] py-[15px] text-[15px] font-bold text-[#0D0D0F] transition-colors hover:bg-white"
          >
            See how it works
          </a>
        </div>
      </div>
    </section>
  );
}
