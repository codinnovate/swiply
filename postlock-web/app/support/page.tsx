import type { Metadata } from "next";
import { SectionHeading } from "../components/section-heading";
import { SUPPORT_EMAIL } from "../lib/site";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Get help with POSTLOCK setup, posting verification, Screen Time, the leaderboard, challenges, and reminders.",
};

const troubleshooting = [
  {
    title: "Posts aren't counting",
    items: [
      "Confirm your X profile is set to public.",
      "Confirm your username is entered correctly.",
      "Give new posts a minute to appear, then tap Check my posts again.",
    ],
  },
  {
    title: "Apps aren't locking, or X is locked",
    items: [
      "Confirm Screen Time permission is enabled for POSTLOCK.",
      "In Apple's picker, select only X. Don't select All Apps or a category: POSTLOCK locks everything else for you.",
      "Reopen POSTLOCK so it can refresh your lock status.",
    ],
  },
  {
    title: "Leaderboard and challenges",
    items: [
      "Join or leave the leaderboard from the Leaderboard tab or Settings.",
      "Challenges need both X profiles to be public.",
      "You can only have one live challenge with the same person at a time.",
    ],
  },
  {
    title: "Reminders and Live Activities",
    items: [
      "Turn on deadline reminders in POSTLOCK's Settings.",
      "If reminders are off, allow notifications in iOS Settings → Notifications → POSTLOCK.",
      "To see challenges on your Lock Screen, make sure Live Activities are allowed for POSTLOCK.",
    ],
  },
];

export default function SupportPage() {
  return (
    <section className="mx-auto w-full max-w-310 px-4 py-16 sm:px-6">
      <SectionHeading title="Support" />
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        <div className="space-y-4 text-sm leading-6 text-muted">
          <p>
            POSTLOCK is an iOS app supporting iPhone. For help with setup,
            posting verification, Screen Time, the leaderboard, challenges,
            or subscriptions, email us directly.
          </p>
          <p>
            Support email:{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="font-semibold text-accent hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
          <p>
            When you write in, please include your X username, the device
            and iOS version you&apos;re using, and a short description of
            what happened. Never send passwords, X login credentials, or
            any account tokens &mdash; POSTLOCK and its support team will
            never ask for them.
          </p>
          <p>
            Subscriptions are managed by Apple. To cancel or change your
            plan, open your Apple ID subscription settings, or tap Manage
            in POSTLOCK&apos;s Settings.
          </p>
          <p>
            Have a privacy request instead? See{" "}
            <a
              href="/privacy#privacy-choices"
              className="font-semibold text-accent hover:underline"
            >
              Privacy choices
            </a>
            .
          </p>
        </div>
        <div>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Troubleshooting
          </h2>
          <div className="space-y-6">
            {troubleshooting.map((group) => (
              <div key={group.title}>
                <h3 className="mb-2 text-sm font-semibold text-foreground">
                  {group.title}
                </h3>
                <ol className="space-y-2">
                  {group.items.map((item, i) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-0.5 text-sm font-semibold text-accent">
                        {i + 1}.
                      </span>
                      <span className="text-sm leading-6 text-muted">
                        {item}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
