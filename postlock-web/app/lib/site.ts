export const SUPPORT_EMAIL = "adeyemis710@gmail.com";
export const OWNER_NAME = "Samuel Adeyemi";
export const APP_STORE_URL: string | null = null;
export const LAST_UPDATED = "September 24, 2026";

export const navLinks = [
  { href: "/#pricing", label: "Pricing" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/support", label: "Support" },
];

export const pricingPlans = [
  {
    id: "monthly",
    name: "Monthly",
    price: "$8",
    period: "/month",
    billing: "Billed monthly. Cancel anytime.",
    badge: null as string | null,
  },
  {
    id: "yearly",
    name: "Yearly",
    price: "$30",
    period: "/year",
    billing: "3-day free trial, then $30/year. Cancel anytime.",
    badge: "Best value",
  },
];

export const footerLinks = [
  { href: "/privacy", label: "Privacy" },
  { href: "/privacy#privacy-choices", label: "Privacy Choices" },
  { href: "/terms", label: "Terms" },
  { href: "/support", label: "Support" },
];
