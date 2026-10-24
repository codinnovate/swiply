import type { Metadata } from "next";
import Link from "next/link";

import { ContactLink, LEGAL_OWNER, LegalPage, LegalSection } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for using Swiply to plan, write, schedule and publish social content.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <LegalSection title="Agreement">
        <p>
          These terms are an agreement between you and {LEGAL_OWNER}, who operates Swiply (&ldquo;Swiply&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account or using Swiply, you agree to them. If you use
          Swiply for an organization, you agree on its behalf. Our{" "}
          <Link href="/privacy" className="font-medium text-foreground underline underline-offset-4">
            Privacy Policy
          </Link>{" "}
          explains how we handle your data.
        </p>
      </LegalSection>

      <LegalSection title="The service">
        <p>
          Swiply helps you plan, write, design, schedule and publish slideshow and video content, and connect social
          accounts such as TikTok, Instagram, Pinterest and X so it can publish for you. Some features use AI to
          generate suggestions. We may add, change or remove features over time.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <p>
          You must be at least 13, or the minimum age required in your country, and able to form a binding contract.
          Keep your login details secure and give us accurate information. You are responsible for activity on your
          account and in workspaces you own, including actions by teammates you invite.
        </p>
      </LegalSection>

      <LegalSection title="Connected accounts">
        <p>
          When you connect TikTok or another platform, you authorize Swiply to act on that account within the
          permissions you approve, such as reading your profile and recent videos and publishing posts you choose to
          publish or schedule. Your use of each platform is also governed by its own terms, including TikTok&apos;s
          Terms of Service, Community Guidelines, Music Usage Confirmation and, where it applies, Branded Content
          Policy. You choose each post&apos;s caption, privacy and interaction settings, and you are responsible for
          disclosing commercial content. You can disconnect any account at any time.
        </p>
      </LegalSection>

      <LegalSection title="Your content">
        <p>
          You own the content you create or upload. You give us a limited licence to host, process, render and publish
          it, only as needed to provide Swiply to you. You promise that you have the rights to everything you upload,
          including music, images and footage, and that it follows the law and each platform&apos;s rules.
        </p>
        <p>
          AI suggestions can be wrong or resemble other content. Review everything before you publish it; you are
          responsible for what you post.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>Do not use Swiply to:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Post spam, run fake engagement, or get around a platform&apos;s limits or rules.</li>
          <li>Post illegal, infringing, hateful, harassing or deceptive content.</li>
          <li>Access accounts you are not authorized to manage.</li>
          <li>Probe, overload or reverse engineer Swiply, or access it through unauthorized automated means.</li>
        </ul>
        <p>We may suspend or remove accounts that break these rules.</p>
      </LegalSection>

      <LegalSection title="Plans and payment">
        <p>
          Paid plans are billed in advance through Stripe at the price shown when you subscribe, and renew
          automatically until you cancel. You can cancel at any time, and access continues until the end of the paid
          period. Except where the law requires, payments are non-refundable. If prices change, we will tell you
          before your next renewal.
        </p>
      </LegalSection>

      <LegalSection title="Ending your use">
        <p>
          You can stop using Swiply at any time and ask us to delete your account by emailing <ContactLink />. We may
          suspend or end access if you break these terms or if we have to for legal reasons. Where possible, we will
          give notice first and a chance to export your content.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimers">
        <p>
          Swiply is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. We do not promise it will always be
          uninterrupted or error-free, or that any platform will accept, keep or promote your posts. Platforms can
          change or revoke API access at any time, which can affect what Swiply can do.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          As far as the law allows, we are not liable for indirect, incidental or consequential losses, or for lost
          profits, followers or data. Our total liability for any claim is limited to what you paid us in the 12
          months before the claim. Nothing in these terms limits liability that cannot be limited by law.
        </p>
      </LegalSection>

      <LegalSection title="Changes to these terms">
        <p>
          We may update these terms. We will change the date at the top and, for significant changes, tell you in
          Swiply or by email. Continuing to use Swiply after a change means you accept it.
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
