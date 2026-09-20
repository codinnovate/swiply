import { PostReel } from "./post-reel";

const avatarColors = ["#FFD9C7", "#BFD9F2", "#D6CDF5", "#FFC59B"];

function TrustBadge() {
  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-white/90 bg-white/78 py-1.5 pl-2 pr-4 text-[13.5px] font-medium text-[#44505E] shadow-[0_6px_18px_-10px_rgba(20,40,70,0.45)]">
      <span className="flex">
        {avatarColors.map((color, i) => (
          <span
            key={color}
            className="block size-[22px] rounded-full border-2 border-white"
            style={i > 0 ? { backgroundColor: color, marginLeft: "-8px" } : { backgroundColor: color }}
          />
        ))}
      </span>
      <span>
        Used by <strong className="font-bold text-[#0D0D0F]">4,200+</strong> SaaS founders
      </span>
    </div>
  );
}

function PromptCard() {
  return (
    <div className="mx-auto mt-10 max-w-[760px] rounded-[22px] bg-white px-[22px] pb-4 pt-[22px] text-left shadow-[0_30px_60px_-30px_rgba(20,45,80,0.35),0_2px_0_rgba(255,255,255,0.6)_inset]">
      <div className="flex items-center gap-0.5 text-[clamp(16px,2vw,19px)] font-semibold text-[#0D0D0F]">
        What are we posting this week?
        <span className="inline-block h-5 w-0.5 animate-[swiply-caret_1.1s_steps(1)_infinite] bg-[#FF5A1F] motion-reduce:animate-none" />
      </div>
      <div className="mt-[34px] flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-[18px]">
          <span className="inline-flex items-center gap-[7px] text-[14.5px] font-semibold text-[#44505E]">
            <span className="text-[18px] leading-none text-[#FF5A1F]">+</span> Brand kit
          </span>
          <span className="inline-flex items-center gap-[7px] text-[14.5px] font-semibold text-[#44505E]">
            <span className="text-[18px] leading-none text-[#FF5A1F]">+</span> Screenshots
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#F2F5F8] px-3 py-1.5 text-xs text-[#7C8793]">5 slides · 9:16</span>
        </div>
        <span className="flex size-11 items-center justify-center rounded-full bg-[#0D0D0F] text-[17px] font-bold text-white">↑</span>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section
      id="top"
      className="relative -mt-[74px] bg-[linear-gradient(180deg,#CBE4FA_0%,#DEEEFB_34%,#EFF6FC_68%,#F6F9FC_100%)] px-5 pt-[130px]"
    >
      <div className="mx-auto max-w-[980px] text-center">
        <TrustBadge />

        <h1 className="mt-[26px] text-balance font-[family-name:var(--font-landing-serif)] text-[clamp(44px,7.4vw,88px)] font-normal leading-[1.0] tracking-[-.018em] text-[#0D0D0F]">
          Stop Making Content for Hours
          <br />
          <span className="text-[#FF5A1F]">Post Slideshows</span> on Autopilot.
        </h1>

        <p className="mx-auto mt-[22px] max-w-[620px] text-[clamp(15px,1.6vw,18px)] font-medium leading-[1.55] text-[#59636E]">
          Swiply turns your product into scroll-stopping image slideshows and publishes them straight to TikTok and
          Instagram. No editor. No scheduler. No posting.
        </p>

        <PromptCard />
      </div>

      <PostReel />
    </section>
  );
}
