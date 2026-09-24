import type { Metadata } from "next";
import { SectionHeading } from "../components/section-heading";
import { SUPPORT_EMAIL } from "../lib/site";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help with POSTLOCK setup, posting verification, or Screen Time permissions.",
};

const troubleshooting = [
  "Confirm your X profile is set to public.",
  "Confirm your username is entered correctly.",
  "Confirm Screen Time permission is enabled for POSTLOCK.",
  "Confirm X is the single app selected in Apple's system picker.",
  "Reopen POSTLOCK and check your posts again.",
];

export default function SupportPage() {
  return (
    <section className="mx-auto w-full max-w-310 px-4 py-16 sm:px-6">
      <SectionHeading title="Support" />
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        <div className="space-y-4 text-sm leading-6 text-muted">
          <p>
            POSTLOCK is an iOS app supporting iPhone. For help with setup,
            posting verification, or Screen Time permissions, email us
            directly.
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
            When you write in, please include your X username, the device
            and iOS version you&apos;re using, and a short description of
            what happened. Never send passwords, X login credentials, or
            any account tokens &mdash; POSTLOCK and its support team will
            never ask for them.
          </p>
          <p>
            Have a privacy request instead? See{" "}
            <a
              href="/privacy#privacy-choices"
              className="font-semibold text-lime hover:underline"
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
          <ol className="space-y-3">
            {troubleshooting.map((item, i) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-0.5 text-sm font-semibold text-lime">
                  {i + 1}.
                </span>
                <span className="text-sm leading-6 text-muted">{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
