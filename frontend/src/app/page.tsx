import { NavBar } from "@/components/marketing/landing/nav-bar";
import { Hero } from "@/components/marketing/landing/hero";
import { PlatformSection } from "@/components/marketing/landing/platform-section";
import { HowItWorks } from "@/components/marketing/landing/how-it-works";
import { Features } from "@/components/marketing/landing/features";
import { Pricing } from "@/components/marketing/landing/pricing";
import { Faq } from "@/components/marketing/landing/faq";
import { CtaBand } from "@/components/marketing/landing/cta-band";
import { SiteFooter } from "@/components/marketing/landing/site-footer";

export default function Home() {
  return (
    <div className="w-full overflow-x-hidden bg-[#F6F9FC] font-[family-name:var(--font-landing-inter)] text-[#0D0D0F]">
      <NavBar />
      <Hero />
      <PlatformSection />
      <HowItWorks />
      <Features />
      <Pricing />
      <Faq />
      <CtaBand />
      <SiteFooter />
    </div>
  );
}
