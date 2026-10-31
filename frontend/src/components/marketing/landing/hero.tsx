import { ArrowRight, ArrowUp, CheckCircle2, ImageIcon, Paperclip, Sparkles, WandSparkles, Zap } from "lucide-react";

import { PostReel } from "./post-reel";

const avatars = [
  { bg: "#C7DBFF", skin: "#9A5A35", hair: "#1F2933", shirt: "#075AF2" },
  { bg: "#BFD9F2", skin: "#E1A56F", hair: "#5A3825", shirt: "#0D0D0F" },
  { bg: "#C9F3EF", skin: "#7D4A2D", hair: "#15191F", shirt: "#11CFC3" },
  { bg: "#A9C8FF", skin: "#F0BE8C", hair: "#7A4325", shirt: "#C4410F" },
];

function FounderAvatar({
  avatar,
  index,
}: {
  avatar: (typeof avatars)[number];
  index: number;
}) {
  return (
    <span
      className="relative block size-[22px] overflow-hidden rounded-full border-2 border-white"
      style={index > 0 ? { backgroundColor: avatar.bg, marginLeft: "-8px" } : { backgroundColor: avatar.bg }}
      aria-hidden="true"
    >
      <span
        className="absolute left-1/2 top-[5px] block size-[10px] -translate-x-1/2 rounded-full"
        style={{ backgroundColor: avatar.skin }}
      >
        <span className="absolute left-[2px] top-[4px] block size-[1.5px] rounded-full bg-[#17202A]" />
        <span className="absolute right-[2px] top-[4px] block size-[1.5px] rounded-full bg-[#17202A]" />
        <span className="absolute left-1/2 top-[7px] block h-px w-[4px] -translate-x-1/2 rounded-full bg-[#6B3423]/70" />
      </span>
      <span
        className="absolute left-1/2 top-[3px] block h-[5px] w-[11px] -translate-x-1/2 rounded-t-full"
        style={{ backgroundColor: avatar.hair }}
      />
      <span
        className="absolute bottom-[-4px] left-1/2 block h-[11px] w-[17px] -translate-x-1/2 rounded-t-full"
        style={{ backgroundColor: avatar.shirt }}
      />
    </span>
  );
}

function TrustBadge() {
  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-white/90 bg-white/78 py-1.5 pl-2 pr-4 text-[13.5px] font-medium text-[#44505E] shadow-[0_6px_18px_-10px_rgba(20,40,70,0.45)]">
      <span className="flex">
        {avatars.map((avatar, i) => (
          <FounderAvatar key={`${avatar.bg}-${avatar.skin}`} avatar={avatar} index={i} />
        ))}
      </span>
      <span>
        Used by <strong className="font-bold text-[#0D0D0F]">4,200+</strong> SaaS founders
      </span>
    </div>
  );
}

function PromptCard() {
  const chips = [
    { icon: Paperclip, label: "Brand kit", color: "#075AF2" },
    { icon: ImageIcon, label: "Screenshots", color: "#11CFC3" },
    { icon: WandSparkles, label: "5 slides - 9:16", color: "#C4410F" },
  ];

  return (
    <div className="relative mx-auto mt-10 w-full max-w-[780px] overflow-hidden rounded-[24px] border border-white/80 bg-white/88 p-2.5 text-left shadow-[0_34px_80px_-38px_rgba(20,45,80,0.5),0_1px_0_rgba(255,255,255,0.86)_inset] backdrop-blur-xl">
      <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-white/35 blur-2xl animate-[swiply-sheen_5s_cubic-bezier(.4,0,.2,1)_infinite] motion-reduce:animate-none" />
      <div className="rounded-[18px] border border-[#E8EEF5] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)] p-[18px] shadow-[0_18px_36px_-34px_rgba(20,45,80,0.55)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#EFF5FF] px-3 py-1.5 text-[12px] font-bold text-[#075AF2]">
            <Sparkles className="size-3.5" strokeWidth={2.4} />
            AI slideshow brief
          </span>
          <span className="text-[12px] font-semibold text-[#8A96A3]">Ready in 42s</span>
        </div>

        <div className="min-h-[86px] text-[clamp(18px,2.4vw,22px)] font-semibold leading-[1.35] tracking-[-.012em] text-[#0D0D0F]">
          What are we posting this week?
          <span className="ml-1 inline-block h-5 w-0.5 translate-y-1 animate-[swiply-caret_1.1s_steps(1)_infinite] bg-[#075AF2] motion-reduce:animate-none" />
          <p className="mt-3 max-w-[610px] text-[14px] font-medium leading-[1.55] tracking-normal text-[#6A7480]">
            Turn the new product screenshots into a founder-led TikTok carousel with a sharp hook, clean captions,
            and an ending that drives trials.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-1.5 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          {chips.map(({ icon: Icon, label, color }) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-[#E4EAF0] bg-white px-3 py-2 text-[12.5px] font-bold text-[#44505E] shadow-[0_8px_18px_-16px_rgba(20,45,80,0.45)]"
            >
              <Icon className="size-3.5" style={{ color }} strokeWidth={2.35} />
              {label}
            </span>
          ))}
        </div>
        <span className="flex size-11 items-center justify-center rounded-full bg-[#0D0D0F] text-white shadow-[0_14px_26px_-14px_rgba(13,13,15,0.8)]">
          <ArrowUp className="size-5" strokeWidth={2.7} />
        </span>
      </div>
    </div>
  );
}

function HeroStudio() {
  const slides = [
    { title: "Before the scroll", color: "#075AF2", rotate: "-6deg", delay: "0s" },
    { title: "Founder lesson", color: "#FF6B35", rotate: "3deg", delay: ".22s" },
    { title: "Ship the proof", color: "#11CFC3", rotate: "-1deg", delay: ".44s" },
  ];

  return (
    <div className="relative mx-auto mt-12 grid max-w-[1040px] gap-4 lg:grid-cols-[1fr_330px]">
      <div className="relative min-h-[360px] overflow-hidden rounded-[34px] border border-white/70 bg-[#111318] p-5 text-left shadow-[0_36px_90px_-50px_rgba(13,13,15,0.8)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(7,90,242,.55),transparent_30%),radial-gradient(circle_at_82%_28%,rgba(255,107,53,.45),transparent_27%),radial-gradient(circle_at_54%_88%,rgba(17,207,195,.35),transparent_32%)]" />
        <div className="absolute inset-0 dot-grid opacity-20" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-[12px] font-bold text-white backdrop-blur">
            <Zap className="size-3.5 text-[#FFE166]" />
            Live content studio
          </div>
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-[#FF6B35]" />
            <span className="size-2.5 rounded-full bg-[#FFE166]" />
            <span className="size-2.5 rounded-full bg-[#11CFC3]" />
          </div>
        </div>

        <div className="relative mt-8 grid min-h-[246px] items-center gap-5 md:grid-cols-[1fr_250px]">
          <div className="relative h-[230px]">
            {slides.map((slide, index) => (
              <div
                key={slide.title}
                className="absolute left-[max(8px,8%)] top-[18px] w-[min(260px,68vw)] rounded-[28px] bg-white p-4 shadow-[0_30px_60px_-36px_rgba(0,0,0,.75)] animate-[swiply-slide-stack_4.8s_ease-in-out_infinite] motion-reduce:animate-none"
                style={{
                  "--rotate": slide.rotate,
                  "--stack-x": `${index * 82}px`,
                  animationDelay: slide.delay,
                } as React.CSSProperties}
              >
                <div className="aspect-[9/12] rounded-[22px] p-4 text-white" style={{ backgroundColor: slide.color }}>
                  <span className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em]">Slide {index + 1}</span>
                  <p className="mt-14 max-w-[160px] text-[26px] font-black leading-[.95] tracking-[-.03em]">{slide.title}</p>
                  <div className="mt-8 space-y-2">
                    <span className="block h-2 w-28 rounded-full bg-white/70" />
                    <span className="block h-2 w-20 rounded-full bg-white/40" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-[24px] border border-white/12 bg-white/12 p-4 text-white backdrop-blur-md">
            {["Brand imported", "Hooks written", "TikTok queued", "Instagram queued"].map((item, index) => (
              <div key={item} className="flex items-center gap-3 border-b border-white/10 py-3 last:border-b-0">
                <CheckCircle2 className="size-4 text-[#11CFC3]" />
                <span className="flex-1 text-[13px] font-bold">{item}</span>
                <span className="text-[11px] font-semibold text-white/45">0{index + 1}</span>
              </div>
            ))}
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <span className="block h-full origin-left rounded-full bg-[linear-gradient(90deg,#11CFC3,#FFE166,#FF6B35)] animate-[swiply-progress_3.2s_cubic-bezier(.2,0,0,1)_infinite_alternate] motion-reduce:animate-none" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <div className="swiply-card-hover rounded-[28px] bg-[#FFE166] p-6 text-left shadow-[0_24px_60px_-44px_rgba(13,13,15,.8)]">
          <p className="m-0 text-[44px] font-black leading-none tracking-[-.04em]">42s</p>
          <p className="m-0 mt-2 text-sm font-bold text-[#513B00]">from site URL to editable slideshow brief</p>
        </div>
        <div className="swiply-card-hover rounded-[28px] bg-[#11CFC3] p-6 text-left shadow-[0_24px_60px_-44px_rgba(13,13,15,.8)]">
          <p className="m-0 text-[44px] font-black leading-none tracking-[-.04em]">30</p>
          <p className="m-0 mt-2 text-sm font-bold text-[#003D39]">posts batched with captions and best-time slots</p>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section
      id="top"
      className="noise relative -mt-[74px] overflow-hidden bg-[#F8FBFF] px-5 pt-[130px]"
    >
      <div className="absolute -left-24 top-20 size-[280px] rounded-full bg-[#FFE166] opacity-80 blur-3xl animate-[swiply-float_8s_ease-in-out_infinite] motion-reduce:animate-none" style={{ "--float-x": "24px", "--float-y": "-18px" } as React.CSSProperties} />
      <div className="absolute right-[-90px] top-32 size-[330px] rounded-full bg-[#11CFC3] opacity-55 blur-3xl animate-[swiply-float_9s_ease-in-out_infinite] motion-reduce:animate-none" style={{ "--float-x": "-18px", "--float-y": "20px" } as React.CSSProperties} />
      <div className="absolute left-[52%] top-[18%] size-[230px] rounded-full bg-[#FF6B35] opacity-35 blur-3xl animate-[swiply-float_10s_ease-in-out_infinite] motion-reduce:animate-none" style={{ "--float-x": "12px", "--float-y": "-22px" } as React.CSSProperties} />

      <div className="relative mx-auto max-w-[1080px] text-center">
        <TrustBadge />

        <h1 className="mx-auto mt-[26px] max-w-[980px] text-balance font-display text-[clamp(35px,11vw,88px)] font-normal leading-[1.0] tracking-[-.018em] text-[#0D0D0F]">
          Turn product updates into <span className="text-[#075AF2]">colorful slideshow engines.</span>
        </h1>

        <p className="mx-auto mt-[22px] max-w-[620px] text-[clamp(15px,1.6vw,18px)] font-medium leading-[1.55] text-[#59636E]">
          Swiply turns your product into scroll-stopping image slideshows and publishes them straight to TikTok and
          Instagram. No editor. No scheduler. No posting.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href="#pricing" className="group inline-flex items-center gap-2 rounded-full bg-[#0D0D0F] px-5 py-3.5 text-[15px] font-black text-white shadow-[0_18px_34px_-18px_rgba(13,13,15,.9)] transition-transform duration-200 hover:-translate-y-0.5 sm:px-6">
            Start free
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </a>
          <a href="#how" className="inline-flex items-center rounded-full border border-[#D9E2EC] bg-white/80 px-5 py-3.5 text-[15px] font-black text-[#0D0D0F] shadow-[0_14px_30px_-24px_rgba(13,13,15,.7)] transition-transform duration-200 hover:-translate-y-0.5 sm:px-6">
            Watch the flow
          </a>
        </div>

        <PromptCard />
        <HeroStudio />
      </div>

      <PostReel />
    </section>
  );
}
