"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { SlideshowPreviewDialog } from "@/components/app/slideshow-preview-dialog";
import { PageLoader } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { ScheduledPost } from "@/lib/types";
import { cn, titleCase } from "@/lib/utils";

const platformColors: Record<string, string> = {
  instagram: "bg-fuchsia-500",
  tiktok: "bg-slate-900 dark:bg-slate-100",
  twitter: "bg-sky-500",
  facebook: "bg-blue-600",
  linkedin: "bg-blue-700",
  pinterest: "bg-red-600",
};

export function CalendarView() {
  const { workspace } = useWorkspace();
  const [month, setMonth] = useState(new Date());
  const [preview, setPreview] = useState<ScheduledPost | null>(null);
  const query = useQuery({
    queryKey: queryKeys.posts(workspace?.id || ""),
    queryFn: () => api<ScheduledPost[]>("/posts", {}, workspace?.id),
    enabled: !!workspace,
  });
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  });

  return (
    <>
      <PageHeader
        eyebrow="Publishing"
        title="Calendar"
        description={`Times are shown in ${workspace?.timezone || "your workspace timezone"}. Click a post to preview the TikTok slideshow.`}
        actions={
          <Button asChild>
            <Link href="/app/content">
              <Plus className="size-4" />
              Schedule post
            </Link>
          </Button>
        }
      />
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b p-4">
          <Button size="icon" variant="ghost" onClick={() => setMonth(subMonths(month, 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <h2 className="font-display text-xl font-semibold">{format(month, "MMMM yyyy")}</h2>
          <Button size="icon" variant="ghost" onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        {query.isLoading ? (
          <PageLoader />
        ) : (
          <>
            <div className="grid grid-cols-7 border-b bg-muted/30">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  key={day}
                  className="p-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const posts = (query.data || []).filter((post) =>
                  isSameDay(new Date(post.scheduledFor), day),
                );
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "min-h-24 border-b border-r p-1.5 sm:min-h-32 sm:p-2",
                      !isSameMonth(day, month) && "bg-muted/20 text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-6 place-items-center rounded-full text-xs",
                        isSameDay(day, new Date()) && "bg-primary font-bold text-primary-foreground",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    <div className="mt-1 space-y-1">
                      {posts.slice(0, 3).map((post) => (
                        <button
                          key={post.id || post._id}
                          type="button"
                          onClick={() => setPreview(post)}
                          className="flex w-full items-center gap-1 overflow-hidden rounded-md bg-muted px-1.5 py-1 text-left text-[10px] hover:bg-primary/10"
                        >
                          <span className={cn("size-1.5 shrink-0 rounded-full", platformColors[post.platform])} />
                          <span className="truncate">
                            {format(new Date(post.scheduledFor), "p")} {titleCase(post.platform)}
                          </span>
                        </button>
                      ))}
                      {posts.length > 3 && (
                        <p className="pl-1 text-[10px] text-muted-foreground">+{posts.length - 3} more</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>
      <SlideshowPreviewDialog
        contentId={preview?.contentId || null}
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        platform={preview?.platform}
        scheduledFor={preview?.scheduledFor}
      />
    </>
  );
}
