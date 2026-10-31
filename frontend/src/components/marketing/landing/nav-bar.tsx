import Image from "next/image";
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
      <nav className="flex max-w-full items-center gap-7 rounded-full border border-white/20 bg-[#0D0D0F]/92 py-2 pl-[22px] pr-2 shadow-[0_18px_40px_-18px_rgba(13,13,15,0.55)] backdrop-blur-xl">
        <Link
          href="#top"
          className="flex items-center gap-[10px] text-white"
        >
          <Image
            src="/brand/swiply-logo-icon-transparent.png"
            alt=""
            width={30}
            height={30}
            priority
            className="size-[30px] rounded-[9px]"
          />
          <span className="font-display text-[23px] font-normal tracking-[-.01em]">
            Swiply
          </span>
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
          className="rounded-full bg-[#FFE166] px-5 py-[11px] text-[14.5px] font-bold text-[#251900] shadow-[0_0_0_1px_rgba(255,255,255,0.3)_inset,0_8px_24px_-8px_rgba(255,225,102,0.8)] transition-transform duration-200 hover:-translate-y-0.5"
        >
          Start free
        </a>
      </nav>
    </div>
  );
}
