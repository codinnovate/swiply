"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/components/app/app-shell";
import { TikTokSlideshowPreview } from "@/components/app/tiktok-slideshow-preview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import type { ContentItem } from "@/lib/types";
import { formatDate, titleCase } from "@/lib/utils";

export function SlideshowPreviewDialog({
  contentId,
  open,
  onOpenChange,
  platform,
  scheduledFor,
}: {
  contentId: string | null;
  open: boolean;
  onOpenChange(open: boolean): void;
  platform?: string;
  scheduledFor?: string;
}) {
  const { workspace } = useWorkspace();
  const content = useQuery({
    queryKey: ["content-preview", workspace?.id, contentId],
    queryFn: () => api<ContentItem>(`/content/${contentId}`, {}, workspace?.id),
    enabled: !!workspace && !!contentId && open,
  });
  const item = content.data;
  const slides = item?.slideshow?.slides ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>TikTok preview</DialogTitle>
          <DialogDescription>
            {scheduledFor
              ? `${platform ? titleCase(platform) : "Slideshow"} · ${formatDate(scheduledFor, true)}`
              : "This is how the slideshow will read on TikTok Photo Mode."}
          </DialogDescription>
        </DialogHeader>
        {content.isLoading ? (
          <div className="grid min-h-80 place-items-center text-sm text-muted-foreground">Loading preview…</div>
        ) : content.isError || !item ? (
          <div className="grid min-h-40 place-items-center text-sm text-muted-foreground">
            Could not load this slideshow.
          </div>
        ) : slides.length === 0 ? (
          <div className="grid min-h-40 place-items-center text-sm text-muted-foreground">
            This post has no slides to preview.
          </div>
        ) : (
          <TikTokSlideshowPreview
            slides={slides}
            caption={item.postCaption}
            hashtags={item.hashtags}
          />
        )}
        {contentId && (
          <Button asChild variant="outline" className="w-full">
            <Link href={`/app/content/${contentId}`}>Open content</Link>
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
