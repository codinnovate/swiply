import Image from "next/image";
import { APP_STORE_URL } from "./lib/site";

const steps = [
  {
    title: "Set your plan",
    body: "Choose your posting days, goal, and deadlines.",
    shot: {
      src: "/screenshots/plan.png",
      alt: "POSTLOCK plan setup screen showing posting days, target, and deadline",
    },
  },
  {
    title: "Keep X available",
    body: "Select X in Apple's private Screen Time picker.",
    shot: {
      src: "/screenshots/protect-focus.png",
      alt: "POSTLOCK screen for selecting X as the app that stays available",
    },
  },
  {
    title: "Check your progress",
    body: "POSTLOCK checks qualifying posts from your public profile.",
    shot: {
      src: "/screenshots/progress.png",
      alt: "POSTLOCK progress screen showing today's posting goal status",
    },
  },
];

function PhoneFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative mx-auto w-full max-w-70 rounded-[2.5rem] border border-surface-border bg-surface p-2 shadow-[0_30px_60px_-25px_rgba(0,0,0,0.7)]">
      <div className="relative aspect-1320/2868 w-full overflow-hidden rounded-4xl bg-black">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(min-width: 768px) 320px, 80vw"
          className="object-cover"
          priority={false}
        />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto w-full max-w-310 px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
        <div className="grid min-w-0 grid-cols-1 items-center gap-12 md:grid-cols-2 md:gap-16">
          <div className="min-w-0">
            <p className="mb-4 text-xs font-semibold tracking-[0.2em] text-lime uppercase">
              Build the habit
            </p>
            <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
              Post first.
              <br />
              Scroll later.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-8 text-muted">
              Set your posting goal, protect your focus, and build a
              consistent habit on X.
            </p>
            <div className="mt-8 flex min-w-0 flex-col gap-4 sm:flex-row">
              {APP_STORE_URL ? (
                <a
                  href={APP_STORE_URL}
                  className="inline-flex h-12 w-full items-center justify-center rounded-full bg-lime px-6 text-center text-base font-semibold text-lime-foreground transition-opacity hover:opacity-90 sm:w-auto"
                >
                  Download on the App Store
                </a>
              ) : (
                <span
                  aria-disabled="true"
                  className="inline-flex h-12 w-full cursor-not-allowed items-center justify-center rounded-full border border-surface-border px-6 text-center text-base font-semibold text-muted sm:w-auto"
                >
                  Coming soon to the App Store
                </span>
              )}
              <a
                href="#how-it-works"
                className="inline-flex h-12 w-full items-center justify-center rounded-full border border-surface-border px-6 text-center text-base font-semibold text-foreground transition-colors hover:border-lime sm:w-auto"
              >
                How POSTLOCK works
              </a>
            </div>
            <p className="mt-8 max-w-md text-sm leading-6 text-muted">
              Choose your schedule. Keep X available. When you miss a
              deadline, POSTLOCK helps remove other app distractions until
              you catch up.
            </p>
          </div>
          <PhoneFrame
            src="/screenshots/today-dashboard.png"
            alt="POSTLOCK Today dashboard showing today's posting goal and progress"
          />
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="border-t border-surface-border bg-surface/40"
      >
        <div className="mx-auto w-full max-w-310 px-4 py-16 sm:px-6">
          <h2 className="mb-10 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            How it works
          </h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.title} className="flex flex-col">
                <span className="mb-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-lime text-sm font-semibold text-lime">
                  {i + 1}
                </span>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="mb-5 text-sm leading-6 text-muted">
                  {step.body}
                </p>
                <div className="max-w-50">
                  <PhoneFrame src={step.shot.src} alt={step.shot.alt} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
