import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PrivacyPage from "@/app/(marketing)/privacy/page";
import TermsPage from "@/app/(marketing)/terms/page";
import { LEGAL_EMAIL } from "@/components/marketing/legal-page";

vi.mock("@/components/marketing/header", () => ({ MarketingHeader: () => null }));
vi.mock("@/components/marketing/footer", () => ({ MarketingFooter: () => null }));

describe("legal pages", () => {
  it("privacy policy explains each TikTok scope and how to delete data", () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? "";

    expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeInTheDocument();
    for (const scope of ["user.info.basic", "video.list", "video.upload", "video.publish"]) {
      expect(text).toContain(scope);
    }
    expect(text).toContain("immediately delete its stored access and refresh");
    expect(text).not.toContain("must publish its reviewed");
    expect(screen.getAllByRole("link", { name: LEGAL_EMAIL })[0]).toHaveAttribute("href", `mailto:${LEGAL_EMAIL}`);
  });

  it("terms link back to the privacy policy and name TikTok's own policies", () => {
    const { container } = render(<TermsPage />);
    const text = container.textContent ?? "";

    expect(screen.getByRole("heading", { level: 1, name: "Terms of Service" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    expect(text).toContain("Music Usage Confirmation");
    expect(text).not.toContain("must publish its reviewed");
  });
});
