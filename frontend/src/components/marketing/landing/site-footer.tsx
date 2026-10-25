import Image from "next/image";

const footerLinks = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#how", label: "How it works" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export function SiteFooter() {
  return (
    <footer className="px-5 pb-11 pt-[34px]">
      <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-5 border-t border-[#E4EAF0] pt-[26px]">
        <div className="flex items-center gap-[9px] font-[family-name:var(--font-landing-serif)] text-[22px] font-normal tracking-[-.01em] text-[#0D0D0F]">
          <Image src="/brand/swiply-logo-icon-transparent.png" alt="" width={22} height={22} className="size-[22px] rounded-[6px]" /> Swiply
        </div>
        <div className="flex flex-wrap gap-[22px] text-sm font-medium">
          {footerLinks.map((link) => (
            <a key={link.label} href={link.href} className="text-[#59636E] transition-colors hover:text-[#0D0D0F]">
              {link.label}
            </a>
          ))}
        </div>
        <div className="text-[11.5px] text-[#5A6470]">© {new Date().getFullYear()} Swiply</div>
      </div>
    </footer>
  );
}
