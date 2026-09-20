import { queue } from "./data";

function AutopilotQueueCard() {
  return (
    <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-7 rounded-[22px] bg-[#0D0D0F] p-8 text-white max-[700px]:col-span-1">
      <div className="min-w-0 flex-[1_1_260px]">
        <h3 className="m-0 text-2xl font-bold tracking-[-.025em]">The autopilot queue</h3>
        <p className="m-0 mt-3 text-[14.5px] font-medium leading-[1.6] text-[#9AA3AD]">
          Approve once and Swiply keeps both accounts fed for weeks. Pause, reshuffle or top up the queue from one screen.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {["best-time posting", "auto-retry", "2 accounts"].map((tag) => (
            <span key={tag} className="rounded-full border border-[#2A2C31] px-3 py-1.5 text-[11px] text-[#C9CCD1]">
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-2">
        {queue.map((item) => (
          <div key={item.title} className="flex items-center gap-3 rounded-xl bg-[#17181C] px-3.5 py-3">
            <span className="block size-2 flex-none animate-[swiply-pulse_2.4s_ease-in-out_infinite] rounded-full bg-[#FF5A1F] motion-reduce:animate-none" />
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{item.title}</span>
            <span className="text-[11px] text-[#7C8793]">{item.when}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureCard({ visual, title, body }: { visual: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col gap-[18px] rounded-[22px] bg-white p-6 shadow-[0_14px_34px_-26px_rgba(20,45,80,0.5)]">
      <div className="flex min-h-[132px] flex-col justify-center gap-2 rounded-[14px] bg-[#F4F7FA] p-4">{visual}</div>
      <div>
        <h3 className="m-0 text-[19px] font-bold tracking-[-.02em] text-[#0D0D0F]">{title}</h3>
        <p className="m-0 mt-2.5 text-[14.5px] font-medium leading-[1.6] text-[#59636E]">{body}</p>
      </div>
    </div>
  );
}

function HookListVisual() {
  const rows = [
    { text: "“We deleted 60% of our UI.”", active: true },
    { text: "“Nobody warns you about churn.”", active: false },
    { text: "“$0 to $8k MRR in 90 days.”", active: false },
  ];
  return (
    <>
      {rows.map((row) => (
        <div
          key={row.text}
          className={`flex items-center gap-[9px] rounded-[9px] border px-2.5 py-2 ${
            row.active ? "border-[#FFD3BF] bg-white" : "border-[#E4EAF0] bg-transparent"
          }`}
        >
          <span className={`block size-1.5 flex-none rounded-full ${row.active ? "bg-[#FF5A1F]" : "bg-[#C9D2DC]"}`} />
          <span className={`text-[11.5px] font-semibold ${row.active ? "text-[#0D0D0F]" : "text-[#5A6470]"}`}>{row.text}</span>
        </div>
      ))}
    </>
  );
}

function BrandSwatchesVisual() {
  return (
    <>
      <div className="flex gap-1.5">
        <span className="block size-[30px] rounded-lg bg-[#FF5A1F]" />
        <span className="block size-[30px] rounded-lg bg-[#0D0D0F]" />
        <span className="block size-[30px] rounded-lg bg-[#CBE4FA]" />
        <span className="block size-[30px] rounded-lg border border-[#E4EAF0] bg-white" />
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="rounded-lg border border-[#E4EAF0] bg-white px-2.5 py-1 font-[family-name:var(--font-landing-serif)] text-[26px] leading-none">
          Aa
        </span>
        <span className="text-[11.5px] font-semibold text-[#5A6470]">Instrument Serif · Inter</span>
      </div>
      <div className="mt-0.5 flex items-center gap-[7px]">
        <span className="text-[10px] font-bold tracking-[.08em] text-[#C4410F]">LOCKED</span>
        <span className="block h-px flex-1 bg-[#E4EAF0]" />
        <span className="text-[10px] font-semibold text-[#5A6470]">every slide</span>
      </div>
    </>
  );
}

function BarChartVisual() {
  const heights = [34, 52, 40, 68, 58, 92, 74];
  return (
    <>
      <div className="flex h-[92px] items-end gap-[7px]">
        {heights.map((h, i) => (
          <span
            key={i}
            className={`block w-3 rounded ${i === 5 ? "bg-[#FF5A1F]" : "bg-[#D9E2EC]"}`}
            style={{ height: `${h}px` }}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-semibold text-[#5A6470]">saves per post</span>
        <span className="text-[10.5px] font-bold text-[#C4410F]">+38% wk 6</span>
      </div>
    </>
  );
}

function PublishLogVisual() {
  const rows = [
    { platform: "TikTok", time: "published 9:10" },
    { platform: "Instagram", time: "published 9:11" },
  ];
  return (
    <>
      {rows.map((row) => (
        <div key={row.platform} className="flex items-center gap-2.5 rounded-[10px] bg-white px-3 py-2.5">
          <span className="block size-[7px] flex-none rounded-full bg-[#12B76A]" />
          <span className="flex-1 text-[12.5px] font-bold">{row.platform}</span>
          <span className="text-[10.5px] font-semibold text-[#5A6470]">{row.time}</span>
        </div>
      ))}
      <div className="flex items-center gap-[7px] px-0.5">
        <span className="text-[10.5px] font-semibold tracking-[.06em] text-[#5A6470]">OFFICIAL APIS · NO PHONE IN THE LOOP</span>
      </div>
    </>
  );
}

export function Features() {
  return (
    <section id="features" className="px-5 pb-24">
      <div className="mx-auto max-w-[1080px]">
        <h2 className="m-0 mb-[34px] max-w-[660px] font-[family-name:var(--font-landing-serif)] text-[clamp(34px,4.8vw,54px)] font-normal leading-[1.05] tracking-[-.015em] text-[#0D0D0F]">
          Built for founders who <span className="text-[#FF5A1F]">don&apos;t have a content team.</span>
        </h2>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3.5">
          <AutopilotQueueCard />
          <FeatureCard
            visual={<HookListVisual />}
            title="Hooks that survive the scroll"
            body="Every slideshow opens with a tested hook pattern, then earns the swipe with one idea per slide."
          />
          <FeatureCard
            visual={<BrandSwatchesVisual />}
            title="Your brand, locked"
            body="Fonts, colors and logo placement stay on-system across every slide — no template drift."
          />
          <FeatureCard
            visual={<BarChartVisual />}
            title="Performance feedback loop"
            body="Saves, watch-through and profile taps flow back in, so next week's batch leans on what worked."
          />
          <FeatureCard
            visual={<PublishLogVisual />}
            title="Native publishing"
            body="Official TikTok and Instagram APIs. No reminder notifications, no phone in the loop."
          />
        </div>
      </div>
    </section>
  );
}
