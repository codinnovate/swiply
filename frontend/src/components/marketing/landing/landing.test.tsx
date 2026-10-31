import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { steps } from "./data";
import { Hero } from "./hero";
import { HowItWorks } from "./how-it-works";
import { NavBar } from "./nav-bar";

const publicDir = path.resolve(__dirname, "../../../../public");

describe("landing page", () => {
  it("hero headline and calls to action point at sections that exist", () => {
    const { container: hero } = render(<Hero />);
    const { container: how } = render(<HowItWorks />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Turn product updates into colorful slideshow engines.");
    expect(within(hero).getByRole("link", { name: /Start free/ })).toHaveAttribute("href", "#pricing");
    expect(within(hero).getByRole("link", { name: "Watch the flow" })).toHaveAttribute("href", "#how");
    expect(how.querySelector("section#how")).not.toBeNull();
  });

  it("how it works shows a card for every step", () => {
    render(<HowItWorks />);

    for (const step of steps) {
      expect(screen.getByRole("heading", { level: 3, name: step.title })).toBeInTheDocument();
      expect(screen.getByText(step.step)).toBeInTheDocument();
    }
  });

  it("nav bar keeps the Start free button and a logo that ships in public/", () => {
    const { container } = render(<NavBar />);

    expect(screen.getByRole("link", { name: "Start free" })).toHaveAttribute("href", "#pricing");
    for (const img of container.querySelectorAll("img")) {
      const src = decodeURIComponent(img.getAttribute("src") ?? "");
      const file = src.match(/\/brand\/[^&?]+\.png/)?.[0];
      if (file) expect(existsSync(path.join(publicDir, file))).toBe(true);
    }
  });

  it("favicon svg embeds a brand image that exists", () => {
    const svg = readFileSync(path.join(publicDir, "icon.svg"), "utf8");
    const href = svg.match(/href="([^"]+)"/)?.[1];

    expect(href).toBe("brand/swiply-logo-1024.png");
    expect(existsSync(path.join(publicDir, href!))).toBe(true);
  });
});
