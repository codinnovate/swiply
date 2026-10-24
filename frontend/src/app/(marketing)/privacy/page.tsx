import type { Metadata } from "next";

import { ContactLink, LEGAL_OWNER, LegalPage, LegalSection } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Swiply collects, uses, stores and deletes your data, including data from connected TikTok accounts.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <LegalSection title="Who we are">
        <p>
          Swiply (&ldquo;Swiply&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is a web app that helps creators plan,
          write and schedule slideshow and video content for social platforms. Swiply is operated by {LEGAL_OWNER}.
          This policy explains what we collect when you use Swiply, why, and how you can have it deleted. Questions
          go to <ContactLink />.
        </p>
      </LegalSection>

      <LegalSection title="Information you give us">
        <ul className="list-disc space-y-2 pl-6">
          <li>Account details: your name, email address and password (stored as a one-way hash).</li>
          <li>Workspace details, such as workspace names and the teammates you invite.</li>
          <li>Content you create in Swiply: ideas, drafts, captions, slides, images, videos and schedules.</li>
          <li>AI provider keys, if you choose to add your own. They are encrypted at rest and never shown again after you save them.</li>
          <li>Messages you send us for support.</li>
        </ul>
      </LegalSection>

      <LegalSection id="tiktok" title="Information from TikTok and other connected accounts">
        <p>
          You can connect TikTok, Instagram, Pinterest, X and Buffer. You sign in on the platform&apos;s own page and
          choose what to allow; Swiply never sees your password for those services. For TikTok, Swiply asks for these
          permissions and uses them only as described:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong className="text-foreground">user.info.basic</strong>: your TikTok display name, avatar and account
            ID, to show which account is connected and to label posts.
          </li>
          <li>
            <strong className="text-foreground">video.list</strong>: the captions, IDs and dates of your recent public
            videos, so Swiply can learn your writing style and suggest captions in your voice. This happens only after
            you agree to it in Swiply.
          </li>
          <li>
            <strong className="text-foreground">video.upload</strong> and{" "}
            <strong className="text-foreground">video.publish</strong>: to upload and post the content you choose,
            with the caption, privacy level and interaction settings you pick on the publish screen. Swiply never posts
            without you choosing to publish or schedule a post.
          </li>
        </ul>
        <p>
          We store the access and refresh tokens the platform issues, encrypted at rest, so scheduled posts can go out
          while you are away. We do not sell TikTok data, use it for advertising, or share it with anyone except the
          service providers listed below as needed to run Swiply.
        </p>
      </LegalSection>

      <LegalSection title="Information collected automatically">
        <p>
          Our servers log basic technical data, such as IP address, browser type and the requests you make, to keep
          Swiply secure and fix problems. We use cookies only to keep you signed in and remember your preferences. We
          do not use advertising cookies.
        </p>
      </LegalSection>

      <LegalSection title="How we use information">
        <ul className="list-disc space-y-2 pl-6">
          <li>To run Swiply: create content, render slideshows and videos, schedule posts and publish them where you ask.</li>
          <li>To generate captions, ideas and voice suggestions with AI.</li>
          <li>To show analytics for your posts, and public data about competitor accounts you choose to track.</li>
          <li>To handle billing, prevent abuse, give support and send account and service emails.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Service providers">
        <p>We share data only with providers that help us run Swiply, and only what each one needs:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Railway (hosting, database and background jobs).</li>
          <li>Amazon Web Services (S3 and CloudFront, for media storage and delivery).</li>
          <li>OpenAI, Anthropic or Google Gemini (AI generation; the prompt and the content needed for it are sent to the provider you use).</li>
          <li>Stripe (payments; we never see or store your full card number).</li>
          <li>Buffer, if you connect it to publish through Buffer.</li>
          <li>Apify (fetching public data about competitor accounts you ask Swiply to analyze).</li>
          <li>Our email provider, for account and service emails.</li>
        </ul>
        <p>We may also disclose information if the law requires it, or to protect Swiply&apos;s users or service.</p>
      </LegalSection>

      <LegalSection title="Retention and deletion">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            When you disconnect TikTok or another account in Swiply, we immediately delete its stored access and refresh
            tokens. You can also revoke Swiply&apos;s access at any time from the platform&apos;s own settings (in TikTok:
            Settings and privacy, then Security and permissions, then Apps and services).
          </li>
          <li>
            Captions imported to learn your voice stay with your workspace so suggestions keep working. Email us and we
            will delete them.
          </li>
          <li>Your content stays in your workspace until you delete it.</li>
          <li>
            To delete your Swiply account and all of its data, email <ContactLink /> from your account&apos;s address.
            We complete deletion within 30 days, except where the law requires us to keep records such as invoices.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          Data is sent over HTTPS. Platform tokens and AI keys are encrypted at rest and are never returned to the
          browser after they are saved. No system is perfectly secure, but we limit who and what can access your data.
        </p>
      </LegalSection>

      <LegalSection id="privacy-choices" title="Your rights">
        <p>
          Depending on where you live, you may have the right to access, correct, export or delete your data, or to
          object to how we use it. Email <ContactLink /> and we will respond within 30 days. You can also complain to
          your local data protection authority.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          Swiply is not for anyone under 13, or under the age of digital consent where you live. We do not knowingly
          collect data from children. If you believe a child has given us data, contact us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          If we change this policy, we will update the date at the top. For significant changes, we will also tell you
          in Swiply or by email.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          {LEGAL_OWNER}, operator of Swiply: <ContactLink />
        </p>
      </LegalSection>
    </LegalPage>
  );
}
