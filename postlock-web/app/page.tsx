import Image from "next/image";

const SUPPORT_EMAIL = "adeyemis710@gmail.com";
const OWNER_NAME = "Samuel Adeyemi";
const APP_STORE_URL: string | null = null;
const LAST_UPDATED = "September 24, 2026";

const navLinks = [
  { href: "#privacy", label: "Privacy" },
  { href: "#terms", label: "Terms" },
  { href: "#support", label: "Support" },
];

const steps = [
  {
    title: "Set your plan",
    body: "Choose your posting days, goal, and deadlines.",
    shot: { src: "/screenshots/plan.png", alt: "POSTLOCK plan setup screen showing posting days, target, and deadline" },
  },
  {
    title: "Keep X available",
    body: "Select X in Apple's private Screen Time picker.",
    shot: { src: "/screenshots/protect-focus.png", alt: "POSTLOCK screen for selecting X as the app that stays available" },
  },
  {
    title: "Check your progress",
    body: "POSTLOCK checks qualifying posts from your public profile.",
    shot: { src: "/screenshots/progress.png", alt: "POSTLOCK progress screen showing today's posting goal status" },
  },
];

const privacyPoints = [
  "Only public X activity is checked.",
  "No X password or account authorization is requested.",
  "POSTLOCK never posts or interacts with X on your behalf.",
  "Screen Time app-selection tokens stay on your device.",
  "You control Screen Time permission through iOS Settings.",
];

const troubleshooting = [
  "Confirm your X profile is set to public.",
  "Confirm your username is entered correctly.",
  "Confirm Screen Time permission is enabled for POSTLOCK.",
  "Confirm X is the single app selected in Apple's system picker.",
  "Reopen POSTLOCK and check your posts again.",
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

function SectionHeading({
  eyebrow,
  title,
  lastUpdated,
}: {
  eyebrow?: string;
  title: string;
  lastUpdated?: string;
}) {
  return (
    <div className="mb-8">
      {eyebrow ? (
        <p className="mb-2 text-xs font-semibold tracking-[0.2em] text-lime uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      {lastUpdated ? (
        <p className="mt-2 text-sm text-muted">Last updated: {lastUpdated}</p>
      ) : null}
    </div>
  );
}

export default function Home() {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <header className="sticky top-0 z-50 border-b border-surface-border bg-background/90 backdrop-blur">
        <nav
          aria-label="Primary"
          className="mx-auto flex w-full max-w-310 items-center justify-between px-4 py-4 sm:px-6"
        >
          <a href="#top" className="flex items-center gap-2.5">
            <Image
              src="/icon.png"
              alt="POSTLOCK app icon"
              width={32}
              height={32}
              className="rounded-[9px]"
            />
            <span className="text-base font-semibold tracking-tight text-foreground">
              POSTLOCK
            </span>
          </a>
          <div className="flex items-center gap-5 sm:gap-6">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="hidden text-sm text-muted transition-colors hover:text-foreground sm:inline-block"
              >
                {link.label}
              </a>
            ))}
            {APP_STORE_URL ? (
              <a
                href={APP_STORE_URL}
                className="hidden h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-lime px-5 text-sm font-semibold text-lime-foreground transition-opacity hover:opacity-90 sm:inline-flex"
              >
                Download on the App Store
              </a>
            ) : (
              <span
                aria-disabled="true"
                className="hidden h-11 shrink-0 cursor-not-allowed items-center justify-center whitespace-nowrap rounded-full border border-surface-border px-5 text-sm font-semibold text-muted sm:inline-flex"
              >
                Coming soon
              </span>
            )}
          </div>
        </nav>
      </header>

      <main id="main-content" className="flex-1">
        {/* Hero */}
        <section id="top" className="mx-auto w-full max-w-310 px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
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

        {/* Privacy summary */}
        <section className="mx-auto w-full max-w-310 px-4 py-16 sm:px-6">
          <div className="rounded-3xl border border-surface-border bg-surface p-8 sm:p-10">
            <h2 className="mb-6 text-2xl font-semibold tracking-tight text-foreground">
              Privacy at a glance
            </h2>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {privacyPoints.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-lime"
                  />
                  <span className="text-sm leading-6 text-muted">
                    {point}
                  </span>
                </li>
              ))}
            </ul>
            <a
              href="#privacy"
              className="mt-6 inline-block text-sm font-semibold text-lime hover:underline"
            >
              Read the full Privacy Policy
            </a>
          </div>
        </section>

        {/* Support */}
        <section
          id="support"
          className="border-t border-surface-border bg-surface/40"
        >
          <div className="mx-auto w-full max-w-310 px-4 py-16 sm:px-6">
            <SectionHeading title="Support" />
            <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
              <div className="space-y-4 text-sm leading-6 text-muted">
                <p>
                  POSTLOCK is an iOS app supporting iPhone. For help with
                  setup, posting verification, or Screen Time permissions,
                  email us directly.
                </p>
                <p>
                  Support email:{" "}
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="font-semibold text-lime hover:underline"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                </p>
                <p>
                  When you write in, please include your X username, the
                  device and iOS version you&apos;re using, and a short
                  description of what happened. Never send passwords, X
                  login credentials, or any account tokens &mdash; POSTLOCK
                  and its support team will never ask for them.
                </p>
                <p>
                  Have a privacy request instead? See{" "}
                  <a
                    href="#privacy-choices"
                    className="font-semibold text-lime hover:underline"
                  >
                    Privacy choices
                  </a>
                  .
                </p>
              </div>
              <div>
                <h3 className="mb-4 text-lg font-semibold text-foreground">
                  Troubleshooting
                </h3>
                <ol className="space-y-3">
                  {troubleshooting.map((item, i) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-0.5 text-sm font-semibold text-lime">
                        {i + 1}.
                      </span>
                      <span className="text-sm leading-6 text-muted">
                        {item}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy choices */}
        <section id="privacy-choices" className="mx-auto w-full max-w-310 px-4 py-16 sm:px-6">
          <SectionHeading title="Privacy choices" />
          <div className="max-w-2xl space-y-4 text-sm leading-6 text-muted">
            <p>You can:</p>
            <ul className="list-inside list-disc space-y-2">
              <li>
                Ask what data is associated with the X username you supplied,
                by emailing{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="font-semibold text-lime hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>
                .
              </li>
              <li>
                Request correction or deletion of any server-held information
                tied to your username by emailing the same address.
              </li>
              <li>
                Revoke Screen Time access at any time in iOS Settings &rarr;
                Screen Time.
              </li>
              <li>
                Remove all locally stored POSTLOCK data by deleting the app
                from your device.
              </li>
            </ul>
            <p>
              Emailing {SUPPORT_EMAIL} is how you reach us for a data
              request; it does not delete an in-app account, since POSTLOCK
              does not currently use one &mdash; the app is set up directly
              with a public X username, with no separate sign-up or
              password.
            </p>
          </div>
        </section>

        {/* Privacy Policy */}
        <section
          id="privacy"
          className="border-t border-surface-border bg-surface/40"
        >
          <div className="mx-auto w-full max-w-310 px-4 py-16 sm:px-6">
            <SectionHeading title="Privacy Policy" lastUpdated={LAST_UPDATED} />
            <div className="max-w-3xl space-y-8 text-sm leading-7 text-muted">
              <div>
                <h3 className="mb-2 text-base font-semibold text-foreground">
                  Scope
                </h3>
                <p>
                  This Privacy Policy describes how POSTLOCK (&ldquo;the
                  app&rdquo;, &ldquo;we&rdquo;) handles information when you
                  use the POSTLOCK iOS app and this website. POSTLOCK is
                  operated independently by {OWNER_NAME}.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-base font-semibold text-foreground">
                  Information you provide
                </h3>
                <p>
                  When you set up POSTLOCK, you provide a public X (Twitter)
                  username. You also choose posting days, a daily posting
                  target, and a deadline. The username, posting schedule,
                  and deadline settings are sent to our backend so it can
                  check your public posting activity against your goal.
                  POSTLOCK does not ask for and does not accept an X
                  password, OAuth token, or any other X account credential.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-base font-semibold text-foreground">
                  Public profile and posting information
                </h3>
                <p>
                  To check whether you&apos;ve met your posting goal,
                  POSTLOCK&apos;s backend looks up your public X profile
                  (to confirm it is public) and your qualifying public
                  posts for the day. This requires your X profile to be set
                  to public. POSTLOCK does not sign in to X, does not post,
                  like, repost, follow, or send messages on your behalf, and
                  cannot access anything that isn&apos;t already publicly
                  visible on X.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-base font-semibold text-foreground">
                  Posting goals, schedule, and verification state
                </h3>
                <p>
                  Your posting days, daily target, deadline, timezone, and
                  the result of each verification check (such as how many
                  qualifying posts were found) are sent to our backend to
                  perform the check and are stored there so your progress
                  can be evaluated. Your current plan and progress are also
                  kept on your device so the app can show your dashboard.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-base font-semibold text-foreground">
                  Screen Time authorization and app tokens
                </h3>
                <p>
                  POSTLOCK uses Apple&apos;s Screen Time frameworks
                  (Family Controls, Managed Settings, Device Activity) to
                  let you choose which single app (X) stays available when
                  you shield other apps after a missed deadline. Apple
                  represents your app selection as an opaque, privacy
                  -preserving token &mdash; POSTLOCK&apos;s code cannot
                  determine which app you selected from that token alone.
                  This selection is stored locally in an app group shared
                  between POSTLOCK and its Screen Time extension, and is
                  not sent to the POSTLOCK backend or any third party.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-base font-semibold text-foreground">
                  Analytics and diagnostics
                </h3>
                <p>
                  The POSTLOCK iOS app does not include any third-party
                  analytics or crash-reporting SDKs. Our backend, like most
                  web servers, generates standard server logs (such as
                  request timestamps and IP address) as part of normal
                  operation; these are used only to operate and secure the
                  service.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-base font-semibold text-foreground">
                  Infrastructure
                </h3>
                <p>
                  The POSTLOCK backend is hosted on Railway. We do not use
                  third-party analytics, advertising, or tracking services
                  in the app.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-base font-semibold text-foreground">
                  Purposes for processing
                </h3>
                <p>
                  We process this information solely to operate POSTLOCK:
                  to set up your posting plan, to check your public posting
                  activity against your goal, to determine whether to shield
                  other apps, and to keep the service secure and reliable.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-base font-semibold text-foreground">
                  Data sharing
                </h3>
                <p>
                  We do not sell your information. We do not share your X
                  username, posting schedule, or verification data with
                  third parties, except with infrastructure providers (such
                  as our hosting provider) strictly to operate the service,
                  or where required by law.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-base font-semibold text-foreground">
                  Data retention
                </h3>
                <p>
                  We retain your username, posting plan, and verification
                  history on our backend for as long as your POSTLOCK setup
                  is active, so the app can continue checking your progress.
                  You can request deletion at any time &mdash; see{" "}
                  <a
                    href="#privacy-choices"
                    className="font-semibold text-lime hover:underline"
                  >
                    Privacy choices
                  </a>
                  .
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-base font-semibold text-foreground">
                  Security
                </h3>
                <p>
                  We use reasonable technical and organizational measures to
                  protect the information POSTLOCK processes. No method of
                  transmission or storage is completely secure, and we
                  cannot guarantee absolute security.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-base font-semibold text-foreground">
                  Your privacy rights
                </h3>
                <p>
                  You can ask what data we hold for your username, request
                  correction or deletion of that data, and control Screen
                  Time access through iOS. See{" "}
                  <a
                    href="#privacy-choices"
                    className="font-semibold text-lime hover:underline"
                  >
                    Privacy choices
                  </a>{" "}
                  for how.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-base font-semibold text-foreground">
                  Children&apos;s privacy
                </h3>
                <p>
                  POSTLOCK requires a public X profile, and X&apos;s own
                  terms set a minimum age for holding an X account.
                  Consistent with that, POSTLOCK is not intended for use by
                  anyone who does not meet X&apos;s minimum age requirement,
                  and we do not knowingly process information from children
                  below that age.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-base font-semibold text-foreground">
                  International processing
                </h3>
                <p>
                  Our backend infrastructure may process and store
                  information in a different country than the one you are
                  located in, depending on our hosting provider&apos;s
                  infrastructure.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-base font-semibold text-foreground">
                  Changes to this policy
                </h3>
                <p>
                  We may update this Privacy Policy from time to time. We
                  will update the &ldquo;Last updated&rdquo; date above when
                  we do.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-base font-semibold text-foreground">
                  Contact
                </h3>
                <p>
                  Questions about this policy can be sent to{" "}
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="font-semibold text-lime hover:underline"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                  .
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-base font-semibold text-foreground">
                  Independence
                </h3>
                <p>
                  POSTLOCK is independent and is not affiliated with,
                  endorsed by, or sponsored by X Corp. or Apple Inc.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Terms of Use */}
        <section id="terms" className="mx-auto w-full max-w-310 px-4 py-16 sm:px-6">
          <SectionHeading title="Terms of Use" lastUpdated={LAST_UPDATED} />
          <div className="max-w-3xl space-y-8 text-sm leading-7 text-muted">
            <div>
              <h3 className="mb-2 text-base font-semibold text-foreground">
                Acceptance of terms
              </h3>
              <p>
                By downloading, installing, or using POSTLOCK, you agree to
                these Terms of Use. If you do not agree, do not use the app.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-semibold text-foreground">
                Eligibility
              </h3>
              <p>
                POSTLOCK requires a public X profile, so you must meet
                X&apos;s own minimum age and eligibility requirements to use
                POSTLOCK.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-semibold text-foreground">
                License
              </h3>
              <p>
                Subject to these Terms, we grant you a limited,
                non-exclusive, non-transferable, revocable license to
                install and use POSTLOCK on Apple devices you own or
                control, for your personal, non-commercial use.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-semibold text-foreground">
                Your responsibility for the username you provide
              </h3>
              <p>
                You are responsible for providing a public X username that
                is your own, or that you are otherwise authorized to
                monitor with POSTLOCK. Do not use POSTLOCK to monitor an
                account you do not have authorization to monitor.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-semibold text-foreground">
                Acceptable use
              </h3>
              <p>
                You agree not to misuse POSTLOCK, interfere with its normal
                operation, attempt to circumvent its verification or Screen
                Time mechanisms in a way that harms the service, or use it
                for any unlawful purpose.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-semibold text-foreground">
                Dependence on X and Apple Screen Time
              </h3>
              <p>
                POSTLOCK depends on the public availability of X and on
                Apple&apos;s Screen Time frameworks. Changes, outages, or
                restrictions on either platform&apos;s side may affect or
                interrupt POSTLOCK&apos;s functionality, and are outside our
                control.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-semibold text-foreground">
                No guarantee of immediate or uninterrupted verification
              </h3>
              <p>
                We do not guarantee that public-post verification will
                always be immediate, accurate, or uninterrupted.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-semibold text-foreground">
                No promise of results
              </h3>
              <p>
                POSTLOCK does not promise or guarantee follower growth,
                engagement, revenue, virality, or any other business or
                personal result from using the app.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-semibold text-foreground">
                Permission and Screen Time limitations
              </h3>
              <p>
                POSTLOCK&apos;s app-blocking feature requires you to grant
                Screen Time permission and to select X as the exception app
                in Apple&apos;s system picker. You can revoke this
                permission at any time in iOS Settings, which will disable
                the blocking feature.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-semibold text-foreground">
                Intellectual property
              </h3>
              <p>
                POSTLOCK, its name, logo, and app content are owned by{" "}
                {OWNER_NAME} or its licensors. These Terms do not grant you
                any rights to our trademarks or branding beyond what is
                needed to use the app as intended.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-semibold text-foreground">
                Third-party services
              </h3>
              <p>
                POSTLOCK relies on third-party services, including X and
                Apple&apos;s operating system frameworks, and is hosted on
                third-party infrastructure. We are not responsible for the
                availability or conduct of those third-party services.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-semibold text-foreground">
                Service changes and availability
              </h3>
              <p>
                We may change, suspend, or discontinue any part of POSTLOCK
                at any time.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-semibold text-foreground">
                Disclaimers
              </h3>
              <p>
                POSTLOCK is provided &ldquo;as is&rdquo; and &ldquo;as
                available&rdquo;, without warranties of any kind, to the
                fullest extent permitted by applicable law.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-semibold text-foreground">
                Limitation of liability
              </h3>
              <p>
                To the fullest extent permitted by applicable law, we are
                not liable for any indirect, incidental, or consequential
                damages arising from your use of POSTLOCK. Nothing in these
                Terms limits liability that cannot be limited under
                applicable law.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-semibold text-foreground">
                Termination
              </h3>
              <p>
                We may suspend or terminate your access to POSTLOCK if you
                violate these Terms. You may stop using POSTLOCK at any
                time by deleting the app.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-semibold text-foreground">
                Governing law
              </h3>
              <p>
                The specific governing law and jurisdiction for these Terms
                have not yet been finalized and will be added here once
                confirmed.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-semibold text-foreground">
                Apple&apos;s Standard EULA
              </h3>
              <p>
                To the extent applicable, Apple&apos;s Standard End User
                License Agreement also applies:{" "}
                <a
                  href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
                  className="font-semibold text-lime hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
                </a>
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-semibold text-foreground">
                Contact
              </h3>
              <p>
                Questions about these Terms can be sent to{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="font-semibold text-lime hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>
                .
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-surface-border">
        <div className="mx-auto w-full max-w-310 px-4 py-12 sm:px-6">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-2.5">
              <Image
                src="/icon.png"
                alt="POSTLOCK app icon"
                width={28}
                height={28}
                className="rounded-lg"
              />
              <span className="text-sm font-semibold text-foreground">
                POSTLOCK
              </span>
            </div>
            <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted">
              <a href="#privacy" className="hover:text-foreground">
                Privacy
              </a>
              <a href="#privacy-choices" className="hover:text-foreground">
                Privacy Choices
              </a>
              <a href="#terms" className="hover:text-foreground">
                Terms
              </a>
              <a href="#support" className="hover:text-foreground">
                Support
              </a>
              <a
                href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
                className="hover:text-foreground"
                target="_blank"
                rel="noopener noreferrer"
              >
                Apple EULA
              </a>
            </nav>
          </div>
          <div className="mt-8 space-y-2 text-xs leading-5 text-muted">
            <p>
              &copy; {new Date().getFullYear()} {OWNER_NAME}. All rights
              reserved.
            </p>
            <p>
              POSTLOCK is not affiliated with, endorsed by, or sponsored by
              X Corp. or Apple Inc.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
