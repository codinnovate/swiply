import { steps } from "./data";

function StepCard({ step, previewLabel, title, body }: (typeof steps)[number]) {
  return (
    <div className="flex flex-col gap-4 rounded-[22px] bg-white p-7 shadow-[0_14px_34px_-26px_rgba(20,45,80,0.5)]">
      <span className="text-xs tracking-[.12em] text-[#FF5A1F]">{step}</span>
      <div className="flex h-[132px] items-center justify-center rounded-[14px] bg-[repeating-linear-gradient(135deg,#F0F4F8_0_9px,#E6ECF3_9px_18px)] p-3 text-center text-[11px] text-[#7C8793]">
        {previewLabel}
      </div>
      <h3 className="m-0 text-[20px] font-bold tracking-[-.02em] text-[#0D0D0F]">{title}</h3>
      <p className="m-0 text-[14.5px] font-medium leading-[1.6] text-[#59636E]">{body}</p>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className="px-5 pb-24">
      <div className="mx-auto max-w-[1080px]">
        <div className="mb-[34px] flex flex-wrap items-end justify-between gap-6">
          <h2 className="m-0 max-w-[600px] font-[family-name:var(--font-landing-serif)] text-[clamp(34px,4.8vw,54px)] font-normal leading-[1.05] tracking-[-.015em] text-[#0D0D0F]">
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
