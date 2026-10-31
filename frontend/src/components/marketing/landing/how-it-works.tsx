import { steps } from "./data";

function ImportBrandVisual() {
  return (
    <div className="relative h-full overflow-hidden rounded-[14px] bg-[#F6F9FC] p-4">
      <div className="absolute right-4 top-4 flex gap-1.5">
        <span className="block size-2 rounded-full bg-[#FF6B35]" />
        <span className="block size-2 rounded-full bg-[#FFD166]" />
        <span className="block size-2 rounded-full bg-[#12B76A]" />
      </div>
      <div className="rounded-[13px] border border-[#E3EAF2] bg-white p-3 shadow-[0_18px_35px_-28px_rgba(13,13,15,0.7)] animate-[swiply-float_5.5s_ease-in-out_infinite] motion-reduce:animate-none" style={{ "--float-y": "-5px" } as React.CSSProperties}>
        <div className="flex items-center gap-2 rounded-[10px] border border-[#DDE6F0] bg-[#F9FBFD] px-2.5 py-2">
          <span className="size-2 rounded-full bg-[#075AF2]" />
          <span className="h-2 flex-1 rounded-full bg-[#CAD8E7]" />
          <span className="rounded-full bg-[#0D0D0F] px-2 py-1 text-[8px] font-bold uppercase tracking-[.08em] text-white">Import</span>
        </div>
        <div className="mt-3 grid grid-cols-[1.1fr_.9fr] gap-3">
          <div className="space-y-2">
            <span className="block h-3 w-20 rounded-full bg-[#0D0D0F]" />
            <span className="block h-2 w-24 rounded-full bg-[#C9D5E3]" />
            <span className="block h-2 w-16 rounded-full bg-[#D9E2EC]" />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <span className="rounded-lg bg-[#075AF2]" />
            <span className="rounded-lg bg-[#0D0D0F]" />
            <span className="rounded-lg bg-[#CBE4FA]" />
            <span className="rounded-lg border border-[#DDE6F0] bg-white" />
          </div>
        </div>
      </div>
      <div className="absolute bottom-4 left-5 right-5 flex items-center gap-2 rounded-full border border-[#E3EAF2] bg-white/90 px-3 py-2 shadow-[0_18px_30px_-26px_rgba(13,13,15,0.55)]">
        <span className="grid size-6 place-items-center rounded-full bg-[#075AF2] text-[10px] font-black text-white">S</span>
        <span className="h-2 flex-1 rounded-full bg-[#D6E0EA]" />
        <span className="text-[9px] font-bold uppercase tracking-[.08em] text-[#12B76A]">Synced</span>
      </div>
    </div>
  );
}

function GenerateSlidesVisual() {
  const cards = ["01", "02", "03", "04"];

  return (
    <div className="relative h-full overflow-hidden rounded-[14px] bg-[#0D0D0F] p-4">
      <div className="absolute inset-x-0 top-0 h-14 bg-[linear-gradient(90deg,#075AF2,#FF6B35)] opacity-25" />
      <div className="relative grid grid-cols-4 gap-2">
        {cards.map((card, index) => (
          <div
            key={card}
            className="min-h-[78px] rounded-[12px] border border-white/10 bg-white p-2 shadow-[0_16px_28px_-24px_rgba(255,255,255,0.8)] animate-[swiply-slide-stack_4.4s_ease-in-out_infinite] motion-reduce:animate-none"
            style={{ "--rotate": `${index % 2 === 0 ? -1 : 1}deg`, animationDelay: `${index * 140}ms`, transform: `translateY(${index % 2 === 0 ? 8 : 0}px)` } as React.CSSProperties}
          >
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-black text-[#075AF2]">{card}</span>
              <span className="size-1.5 rounded-full bg-[#FF6B35]" />
            </div>
            <span className="mt-3 block h-2.5 rounded-full bg-[#0D0D0F]" />
            <span className="mt-1.5 block h-1.5 w-3/4 rounded-full bg-[#C9D5E3]" />
            <span className="mt-1.5 block h-1.5 w-1/2 rounded-full bg-[#D9E2EC]" />
            <div className="mt-3 h-4 rounded-md bg-[#EAF2FF]" />
          </div>
        ))}
      </div>
      <div className="relative mt-4 flex items-center justify-between rounded-full border border-white/10 bg-white/10 px-3 py-2 text-white backdrop-blur">
        <span className="text-[9px] font-bold uppercase tracking-[.08em] text-[#C9D5E3]">30 posts generated</span>
        <span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-[#0D0D0F]">Review</span>
      </div>
    </div>
  );
}

function PublishQueueVisual() {
  const rows = [
    { platform: "TikTok", time: "Tue 9:10" },
    { platform: "Instagram", time: "Wed 11:40" },
    { platform: "TikTok", time: "Fri 8:05" },
  ];

  return (
    <div className="relative h-full overflow-hidden rounded-[14px] bg-[#F5F8FB] p-4">
      <div className="absolute left-8 top-5 h-[98px] w-px bg-[#D4E0EC]" />
      <div className="space-y-2.5">
        {rows.map((row, index) => (
          <div key={row.platform + row.time} className="relative flex items-center gap-3 rounded-[12px] border border-[#E3EAF2] bg-white px-3 py-2.5 shadow-[0_16px_30px_-27px_rgba(13,13,15,0.65)] animate-[swiply-rise_.7s_cubic-bezier(.2,0,0,1)_both]" style={{ animationDelay: `${index * 130}ms` }}>
            <span className="z-10 grid size-5 place-items-center rounded-full bg-[#075AF2] text-[8px] font-black text-white">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate text-[11px] font-black text-[#0D0D0F]">{row.platform}</p>
              <p className="m-0 mt-0.5 text-[9px] font-semibold text-[#71808F]">{row.time}</p>
            </div>
            <span className="rounded-full bg-[#EAF8F0] px-2 py-1 text-[8px] font-black uppercase tracking-[.08em] text-[#12B76A]">Queued</span>
          </div>
        ))}
      </div>
      <div className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-[#0D0D0F] px-3 py-2 text-[9px] font-black uppercase tracking-[.08em] text-white">
        <span className="size-1.5 rounded-full bg-[#12B76A]" />
        Autopilot on
      </div>
    </div>
  );
}

function StepVisual({ step, label }: { step: string; label: string }) {
  return (
    <div aria-label={label} className="h-[132px]">
      {step === "STEP 01" ? <ImportBrandVisual /> : step === "STEP 02" ? <GenerateSlidesVisual /> : <PublishQueueVisual />}
    </div>
  );
}

function StepCard({ step, previewLabel, title, body }: (typeof steps)[number]) {
  return (
    <div className="swiply-card-hover flex flex-col gap-4 rounded-[26px] bg-white p-7 shadow-[0_14px_34px_-26px_rgba(20,45,80,0.5)]">
      <span className="text-xs tracking-[.12em] text-[#075AF2]">{step}</span>
      <StepVisual step={step} label={previewLabel} />
      <h3 className="m-0 text-[20px] font-bold tracking-[-.02em] text-[#0D0D0F]">{title}</h3>
      <p className="m-0 text-[14.5px] font-medium leading-[1.6] text-[#59636E]">{body}</p>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className="bg-[#F8FBFF] px-5 pb-24 pt-8">
      <div className="mx-auto max-w-[1080px]">
        <div className="mb-[34px] flex flex-wrap items-end justify-between gap-6">
          <h2 className="m-0 max-w-[600px] font-display text-[clamp(34px,4.8vw,54px)] font-normal leading-[1.05] tracking-[-.015em] text-[#0D0D0F]">
            Connect once.
            <br />
            Then never open an editor again.
          </h2>
          <p className="m-0 max-w-[340px] text-[15.5px] font-medium leading-[1.6] text-[#59636E]">
            Swiply learns your product, writes the hooks, lays out the slides and hits publish on schedule.
          </p>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3.5">
          {steps.map((step) => (
            <StepCard key={step.step} {...step} />
          ))}
        </div>
      </div>
    </section>
  );
}
