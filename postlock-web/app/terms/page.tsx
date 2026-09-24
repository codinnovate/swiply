import type { Metadata } from "next";
import { SectionHeading } from "../components/section-heading";
import { LAST_UPDATED, OWNER_NAME, SUPPORT_EMAIL } from "../lib/site";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The terms that govern your use of the POSTLOCK iOS app.",
};

export default function TermsPage() {
  return (
    <section className="mx-auto w-full max-w-310 px-4 py-16 sm:px-6">
      <SectionHeading title="Terms of Use" lastUpdated={LAST_UPDATED} />
      <div className="max-w-3xl space-y-8 text-sm leading-7 text-muted">
        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            Acceptance of terms
          </h2>
          <p>
            By downloading, installing, or using POSTLOCK, you agree to
            these Terms of Use. If you do not agree, do not use the app.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            Eligibility
          </h2>
          <p>
            POSTLOCK requires a public X profile, so you must meet X&apos;s
            own minimum age and eligibility requirements to use POSTLOCK.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            License
          </h2>
          <p>
            Subject to these Terms, we grant you a limited, non-exclusive,
            non-transferable, revocable license to install and use POSTLOCK
            on Apple devices you own or control, for your personal,
            non-commercial use.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            Subscriptions and payment
          </h2>
          <p>
            POSTLOCK offers an optional paid subscription with two plans: a
            monthly plan at $8.00/month, and a yearly plan at $30.00/year
            that includes a 3-day free trial. All payments are processed by
            Apple through the App Store and charged to your Apple ID
            account; POSTLOCK does not receive or store your payment card
            details.
          </p>
          <p className="mt-3">
            If you start the yearly plan&apos;s free trial, you will not be
            charged during the 3-day trial. Unless you cancel at least 24
            hours before the trial ends, your subscription automatically
            renews and your Apple ID account will be charged $30.00 for the
            first year. Subscriptions automatically renew for successive
            periods (monthly or yearly, matching your plan) unless canceled
            at least 24 hours before the end of the current period, and
            your account will be charged for renewal within 24 hours prior
            to the end of the current period.
          </p>
          <p className="mt-3">
            You can manage or cancel your subscription, and view or change
            your trial or renewal status, at any time in your Apple ID
            account&apos;s subscription settings on your device. Canceling
            stops future renewals but does not refund any amount already
            charged for the current period. We may change subscription
            prices from time to time; where required, you will be notified
            of a price change in advance, and continuing to use POSTLOCK
            after a price change takes effect constitutes acceptance of the
            new price. Refund requests are handled by Apple in accordance
            with the App Store&apos;s own refund policies, not by us.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            Your responsibility for the username you provide
          </h2>
          <p>
            You are responsible for providing a public X username that is
            your own, or that you are otherwise authorized to monitor with
            POSTLOCK. Do not use POSTLOCK to monitor an account you do not
            have authorization to monitor.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            Acceptable use
          </h2>
          <p>
            You agree not to misuse POSTLOCK, interfere with its normal
            operation, attempt to circumvent its verification or Screen
            Time mechanisms in a way that harms the service, or use it for
            any unlawful purpose.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            Dependence on X and Apple Screen Time
          </h2>
          <p>
            POSTLOCK depends on the public availability of X and on
            Apple&apos;s Screen Time frameworks. Changes, outages, or
            restrictions on either platform&apos;s side may affect or
            interrupt POSTLOCK&apos;s functionality, and are outside our
            control.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            No guarantee of immediate or uninterrupted verification
          </h2>
          <p>
            We do not guarantee that public-post verification will always
            be immediate, accurate, or uninterrupted.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            No promise of results
          </h2>
          <p>
            POSTLOCK does not promise or guarantee follower growth,
            engagement, revenue, virality, or any other business or
            personal result from using the app.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            Permission and Screen Time limitations
          </h2>
          <p>
            POSTLOCK&apos;s app-blocking feature requires you to grant
            Screen Time permission and to select X as the exception app in
            Apple&apos;s system picker. You can revoke this permission at
            any time in iOS Settings, which will disable the blocking
            feature.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            Intellectual property
          </h2>
          <p>
            POSTLOCK, its name, logo, and app content are owned by{" "}
            {OWNER_NAME} or its licensors. These Terms do not grant you any
            rights to our trademarks or branding beyond what is needed to
            use the app as intended.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            Third-party services
          </h2>
          <p>
            POSTLOCK relies on third-party services, including X and
            Apple&apos;s operating system frameworks, and is hosted on
            third-party infrastructure. We are not responsible for the
            availability or conduct of those third-party services.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            Service changes and availability
          </h2>
          <p>
            We may change, suspend, or discontinue any part of POSTLOCK at
            any time.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            Disclaimers
          </h2>
          <p>
            POSTLOCK is provided &ldquo;as is&rdquo; and &ldquo;as
            available&rdquo;, without warranties of any kind, to the
            fullest extent permitted by applicable law.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            Limitation of liability
          </h2>
          <p>
            To the fullest extent permitted by applicable law, we are not
            liable for any indirect, incidental, or consequential damages
            arising from your use of POSTLOCK. Nothing in these Terms
            limits liability that cannot be limited under applicable law.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            Termination
          </h2>
          <p>
            We may suspend or terminate your access to POSTLOCK if you
            violate these Terms. You may stop using POSTLOCK at any time by
            deleting the app.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            Governing law
          </h2>
          <p>
            The specific governing law and jurisdiction for these Terms
            have not yet been finalized and will be added here once
            confirmed.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            Apple&apos;s Standard EULA
          </h2>
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
          <h2 className="mb-2 text-base font-semibold text-foreground">
            Contact
          </h2>
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
  );
}
