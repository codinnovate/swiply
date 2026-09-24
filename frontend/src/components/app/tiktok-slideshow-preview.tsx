"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PreviewSlide = {
  imageUrl: string;
  caption?: string | null;
  altText?: string | null;
};

export function TikTokSlideshowPreview({
  slides,
  caption,
  hashtags = [],
  autoPlay = true,
  className,
}: {
  slides: PreviewSlide[];
  caption?: string;
  hashtags?: string[];
  autoPlay?: boolean;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = slides.length;
  const slide = slides[index];

  useEffect(() => {
    setIndex(0);
  }, [slides]);

  useEffect(() => {
    if (!autoPlay || paused || total < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % total);
    }, 2800);
    return () => window.clearInterval(timer);
  }, [autoPlay, paused, total]);

  if (!slide) {
    return (
      <div className={cn("grid aspect-9/16 place-items-center rounded-4xl bg-muted text-sm text-muted-foreground", className)}>
        No slides yet
      </div>
    );
  }

  return (
    <div className={cn("mx-auto w-full max-w-70", className)}>
      <div
        className="relative overflow-hidden rounded-4xl bg-black shadow-2xl ring-1 ring-black/40"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="relative aspect-9/16">
          <img
            src={slide.imageUrl}
            alt={slide.altText || slide.caption || `Slide ${index + 1}`}
            className="size-full object-cover"
          />
          <div className="absolute inset-0 bg-black/25" />
          <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-b from-black/50 to-transparent" />
          <p className="absolute left-3 top-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
            TikTok · Photo
          </p>
          <p className="absolute right-3 top-3 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white">
            {index + 1}/{total}
          </p>
          {slide.caption && (
            <p className="pointer-events-none absolute inset-x-5 top-1/2 -translate-y-1/2 text-center font-display text-[1.85rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.9)]">
              {slide.caption}
            </p>
          )}
          {total > 1 && (
            <>
              <button
                type="button"
                className="absolute inset-y-0 left-0 w-1/3"
                aria-label="Previous slide"
                onClick={() => setIndex((current) => (current - 1 + total) % total)}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 w-1/3"
                aria-label="Next slide"
                onClick={() => setIndex((current) => (current + 1) % total)}
              />
            </>
          )}
        </div>
        <div className="space-y-2 px-4 pb-4 pt-3 text-white">
          <p className="line-clamp-2 text-xs leading-5 text-white/90">{caption || "Untitled slideshow"}</p>
          {hashtags.length > 0 && (
            <p className="line-clamp-1 text-[11px] text-white/60">{hashtags.join(" ")}</p>
          )}
          {total > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-1">
              {slides.map((_, slideIndex) => (
                <button
                  key={slideIndex}
                  type="button"
                  aria-label={`Go to slide ${slideIndex + 1}`}
                  onClick={() => setIndex(slideIndex)}
                  className={cn(
                    "h-1.5 rounded-full transition",
                    slideIndex === index ? "w-4 bg-white" : "w-1.5 bg-white/35",
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      {total > 1 && (
        <div className="mt-3 flex justify-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIndex((current) => (current - 1 + total) % total)}
          >
            <ChevronLeft className="size-4" />
            Prev
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setIndex((current) => (current + 1) % total)}>
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
