import type { Metadata } from "next";
import { SectionHeading } from "../components/section-heading";
import { LAST_UPDATED, OWNER_NAME, SUPPORT_EMAIL } from "../lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How POSTLOCK handles your public X username and posts, post scores, leaderboard and challenge data, and Screen Time permissions.",
};

export default function PrivacyPage() {
  return (
    <>
      <section className="mx-auto w-full max-w-310 px-4 py-16 sm:px-6">
        <SectionHeading title="Privacy Policy" lastUpdated={LAST_UPDATED} />
        <div className="max-w-3xl space-y-8 text-sm leading-7 text-muted">
          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              Scope
            </h2>
            <p>
              This Privacy Policy describes how POSTLOCK (&ldquo;the
              app&rdquo;, &ldquo;we&rdquo;) handles information when you use
              the POSTLOCK iOS app and this website. POSTLOCK is operated
              independently by {OWNER_NAME}.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              Information you provide
            </h2>
            <p>
              When you set up POSTLOCK, you provide a public X (Twitter)
              username. You also choose posting days, a daily posting
              target, and a deadline. The username, posting schedule, and
              deadline settings are sent to our backend so it can check your
              public posting activity against your goal. POSTLOCK does not
              ask for and does not accept an X password, OAuth token, or any
              other X account credential.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              Public profile and posting information
            </h2>
            <p>
              To check whether you&apos;ve met your posting goal,
              POSTLOCK&apos;s backend looks up your public X profile (to
              confirm it is public) and your qualifying public posts for the
              day. This requires your X profile to be set to public.
              POSTLOCK does not sign in to X, does not post, like, repost,
              follow, or send messages on your behalf, and cannot access
              anything that isn&apos;t already publicly visible on X.
            </p>
            <p className="mt-3">
              Public posts are fetched through FxTwitter, a third-party
              service that returns publicly visible X data; POSTLOCK does
              not use the X API. To score your posts and calculate XP, our
              backend stores details of your public posts: the post text
              (including thread and quoted-post text), when it was posted,
              media type, links and hashtags, and public engagement counts
              such as replies, reposts, likes, and views. It also records
              the IDs and times of replies you post on other people&apos;s
              public posts, which count toward your XP. Your public display
              name and profile photo URL are stored so they can be shown in
              the app.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              Post scores, insights, and AI processing
            </h2>
            <p>
              POSTLOCK scores each post out of 100, generates insights, and
              can suggest rewritten versions of a post or post ideas for a
              niche you choose. To do this, our backend sends the text of
              your public posts (and, for post ideas, your chosen niche) to
              a third-party AI model provider, currently OpenAI, and stores
              the resulting scores and insights with your post history. We
              send only the post content and details needed for scoring,
              not your device information or Screen Time data. AI-generated
              scores, insights, and suggestions are estimates and may be
              inaccurate.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              Leaderboard (optional)
            </h2>
            <p>
              The leaderboard is off until you choose to join it. When you
              join, your X display name, @username, profile photo, level,
              XP, and rank become visible to other POSTLOCK users. We also
              store your chosen niche and timezone to group and time the
              rankings. You can leave the leaderboard at any time in
              Settings, which removes you from the rankings shown to other
              users. To also delete the stored record, contact us as
              described in{" "}
              <a
                href="#privacy-choices"
                className="font-semibold text-accent hover:underline"
              >
                Privacy choices
              </a>
              .
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              Challenges
            </h2>
            <p>
              You can challenge any public X account to a 24-hour or 7-day
              posting duel. When you start a challenge, our backend stores
              both usernames, public display names, and profile photo URLs,
              the challenge duration and status, and a count of each
              side&apos;s qualifying public posts during the challenge.
              Both participants can see each other&apos;s public name,
              photo, and score. If the other person uses POSTLOCK, they can
              accept or decline. Profile photos for active challenges are
              saved on your device so the challenge can appear in a Live
              Activity on your Lock Screen.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              Install identifier
            </h2>
            <p>
              The app creates a random install ID and sends it to our
              backend when you join or leave the leaderboard or take part
              in a challenge. It is used only to confirm that requests to
              change your leaderboard entry or respond to a challenge come
              from the same install. It is not an advertising identifier and is
              not used to track you across other apps or websites.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              Notifications and Live Activities
            </h2>
            <p>
              If you allow notifications, POSTLOCK schedules deadline
              reminders on your device. These are local notifications: we
              do not collect a push notification token. Challenge Live
              Activities are also created and updated on your device. You
              can turn either off at any time in iOS Settings or in
              POSTLOCK&apos;s Settings.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              Posting goals, schedule, and verification state
            </h2>
            <p>
              Your posting days, daily target, deadline, timezone, and the
              result of each verification check (such as how many
              qualifying posts were found) are sent to our backend to
              perform the check and are stored there so your progress can be
              evaluated. Your current plan and progress are also kept on
              your device so the app can show your dashboard.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              Screen Time authorization and app tokens
            </h2>
            <p>
              POSTLOCK uses Apple&apos;s Screen Time frameworks (Family
              Controls, Managed Settings, Device Activity) to let you choose
              which single app (X) stays available when you shield other
              apps after a missed deadline. Apple represents your app
              selection as an opaque, privacy-preserving token &mdash;
              POSTLOCK&apos;s code cannot determine which app you selected
              from that token alone. This selection is stored locally in an
              app group shared between POSTLOCK and its Screen Time
              extension, and is not sent to the POSTLOCK backend or any
              third party.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              Analytics and diagnostics
            </h2>
            <p>
              The POSTLOCK iOS app does not include any third-party
              analytics, advertising, or crash-reporting SDKs. Our backend, like most web
              servers, generates standard server logs (such as request
              timestamps and IP address) as part of normal operation; these
              are used only to operate and secure the service.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              Infrastructure
            </h2>
            <p>
              The POSTLOCK backend is hosted on Railway, and its database on
              MongoDB Atlas.
              We do not use third-party analytics, advertising, or tracking
              services in the app.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              Payments
            </h2>
            <p>
              POSTLOCK offers optional paid subscriptions. All payments are
              processed by Apple through the App Store; we do not receive
              or store your payment card details. The app uses RevenueCat
              to check your subscription status. RevenueCat receives an
              anonymous app user ID, your App Store purchase and
              subscription history, and basic device details such as iOS
              version and region. It does not receive your X username.
              Apple&apos;s and RevenueCat&apos;s handling of this
              information is governed by their own privacy policies.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              Purposes for processing
            </h2>
            <p>
              We process this information solely to operate POSTLOCK: to
              set up your posting plan, to check your public posting
              activity against your goal, to determine whether to shield
              other apps, to score your posts and calculate XP, to run the
              leaderboard and challenges you choose to take part in, to
              send the reminders you turn on, and to keep the service
              secure and reliable.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              Data sharing
            </h2>
            <p>
              We do not sell your information and do not share it for
              advertising. We share information only:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-2">
              <li>
                With service providers that help us run POSTLOCK, strictly
                to operate the service: Railway (hosting), MongoDB Atlas
                (database),
                FxTwitter (fetching public X data), OpenAI (post scoring,
                insights, and suggestions), and RevenueCat (subscription
                status).
              </li>
              <li>
                With other POSTLOCK users, when you join the leaderboard or
                take part in a challenge, as described above.
              </li>
              <li>Where required by law.</li>
            </ul>
          </div>

          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              Data retention
            </h2>
            <p>
              We retain your username, posting plan, verification history,
              scored posts, XP, leaderboard record, and challenge history
              on our backend for as long as your POSTLOCK setup is active,
              so the app can continue checking your progress and showing
              your history. You
              can request deletion at any time &mdash; see{" "}
              <a
                href="#privacy-choices"
                className="font-semibold text-accent hover:underline"
              >
                Privacy choices
              </a>
              .
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              Security
            </h2>
            <p>
              We use reasonable technical and organizational measures to
              protect the information POSTLOCK processes. No method of
              transmission or storage is completely secure, and we cannot
              guarantee absolute security.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              Your privacy rights
            </h2>
            <p>
              You can ask what data we hold for your username, request
              correction or deletion of that data, and control Screen Time
              access through iOS. See{" "}
              <a
                href="#privacy-choices"
                className="font-semibold text-accent hover:underline"
              >
                Privacy choices
              </a>{" "}
              for how.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              Children&apos;s privacy
            </h2>
            <p>
              POSTLOCK requires a public X profile, and X&apos;s own terms
              set a minimum age for holding an X account. Consistent with
              that, POSTLOCK is not intended for use by anyone who does not
              meet X&apos;s minimum age requirement, and we do not knowingly
              process information from children below that age.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              International processing
            </h2>
            <p>
              Our backend infrastructure may process and store information
              in a different country than the one you are located in,
              depending on our hosting provider&apos;s infrastructure.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              Changes to this policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will
              update the &ldquo;Last updated&rdquo; date above when we do.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              Contact
            </h2>
            <p>
              Questions about this policy can be sent to{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-semibold text-accent hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              Independence
            </h2>
            <p>
              POSTLOCK is independent and is not affiliated with, endorsed
              by, or sponsored by X Corp. or Apple Inc.
            </p>
          </div>
        </div>
      </section>

      {/* Privacy choices */}
      <section
        id="privacy-choices"
        className="border-t border-surface-border bg-surface/40"
      >
        <div className="mx-auto w-full max-w-310 px-4 py-16 sm:px-6">
          <SectionHeading title="Privacy choices" />
          <div className="max-w-2xl space-y-4 text-sm leading-6 text-muted">
            <p>You can:</p>
            <ul className="list-inside list-disc space-y-2">
              <li>
                Ask what data is associated with the X username you
                supplied, by emailing{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="font-semibold text-accent hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>
                .
              </li>
              <li>
                Request correction or deletion of any server-held
                information tied to your username, including scored posts,
                XP, leaderboard records, and challenges, by emailing the
                same address. If someone challenged your public X account
                and you don&apos;t use POSTLOCK, you can ask us to delete
                that challenge the same way.
              </li>
              <li>
                Leave the leaderboard at any time in POSTLOCK&apos;s
                Settings.
              </li>
              <li>
                Decline challenges you receive, and turn reminders off in
                POSTLOCK&apos;s Settings or iOS Settings &rarr;
                Notifications.
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
        </div>
      </section>
    </>
  );
}
