import Link from "next/link";

const navLinks = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#platforms", label: "Platforms" },
  { href: "#pricing", label: "Pricing" },
];

export function NavBar() {
  return (
    <div className="sticky top-0 z-50 flex justify-center px-4 pt-[18px]">
      <nav className="flex max-w-full items-center gap-7 rounded-full bg-[#0D0D0F] py-2 pl-[22px] pr-2 shadow-[0_18px_40px_-18px_rgba(13,13,15,0.55)]">
        <Link
          href="#top"
          className="flex items-center gap-[9px] font-[family-name:var(--font-landing-serif)] text-[23px] font-normal tracking-[-.01em] text-white"
        >
          <span className="block size-5 rounded-[6px] bg-[#FF5A1F]" />
          Swiply
        </Link>
        <div className="hidden items-center gap-[22px] text-[14.5px] font-medium sm:flex">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="text-[#C9CCD1] transition-colors hover:text-white">
              {link.label}
            </a>
          ))}
        </div>
        <a
          href="#pricing"
          className="rounded-full bg-[#FF5A1F] px-5 py-[11px] text-[14.5px] font-bold text-white shadow-[0_0_0_1px_rgba(255,140,90,0.5)_inset,0_8px_24px_-6px_rgba(255,90,31,0.8)] transition-colors hover:bg-[#FF6F3C]"
        >
          Start free
        </a>
      </nav>
    </div>
  );
}
