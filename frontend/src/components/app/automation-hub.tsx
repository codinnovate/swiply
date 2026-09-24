"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Clock3,
  LoaderCircle,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { SlideshowPreviewDialog } from "@/components/app/slideshow-preview-dialog";
import { EmptyState, PageLoader } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { ContentItem, Schedule, ScheduledPost, SocialAccount } from "@/lib/types";
import { formatDate, titleCase } from "@/lib/utils";

function scheduleId(item: Schedule) {
  return item.id || item._id || "";
}

export function AutomationHub() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"automations" | "queue" | "activity">("automations");
  const [preview, setPreview] = useState<{ contentId: string; scheduledFor?: string } | null>(null);
  const schedules = useQuery({
    queryKey: queryKeys.schedules(workspace?.id || ""),
    queryFn: () => api<Schedule[]>("/schedules", {}, workspace?.id),
    enabled: !!workspace,
  });
  const accounts = useQuery({
    queryKey: queryKeys.accounts(workspace?.id || ""),
    queryFn: () => api<SocialAccount[]>("/social-accounts", {}, workspace?.id),
    enabled: !!workspace,
  });
  const posts = useQuery({
    queryKey: queryKeys.posts(workspace?.id || ""),
    queryFn: () => api<ScheduledPost[]>("/posts", {}, workspace?.id),
    enabled: !!workspace,
  });
  const content = useQuery({
    queryKey: queryKeys.content(workspace?.id || "", "slideshow"),
    queryFn: () => api<ContentItem[]>("/content?type=slideshow", {}, workspace?.id),
    enabled: !!workspace,
  });
  const audit = useQuery({
    queryKey: ["automation-audit", workspace?.id],
    queryFn: () =>
      api<Array<{ id?: string; summary: string; createdAt: string; action: string }>>(
        "/automation/audit-log",
        {},
        workspace?.id,
      ),
    enabled: !!workspace && tab === "activity",
    retry: false,
  });
  const toggle = useMutation({
    mutationFn: (item: Schedule) =>
      api(
        `/schedules/${scheduleId(item)}/${item.status === "active" ? "pause" : "resume"}`,
        { method: "PATCH" },
        workspace?.id,
      ),
    onSuccess: () => {
      toast.success("Automation updated");
      qc.invalidateQueries({ queryKey: ["schedules"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update"),
  });
  const remove = useMutation({
    mutationFn: (item: Schedule) =>
      api(`/schedules/${scheduleId(item)}`, { method: "DELETE" }, workspace?.id),
    onSuccess: () => {
      toast.success("Automation removed");
      qc.invalidateQueries({ queryKey: ["schedules"] });
    },
  });
  const testPost = useMutation({
    mutationFn: (item: Schedule) =>
      api(`/automation/${scheduleId(item)}/test-post`, { method: "POST" }, workspace?.id),
    onSuccess: () => {
      toast.success("Test post sent");
      qc.invalidateQueries({ queryKey: ["posts"] });
      qc.invalidateQueries({ queryKey: ["automation-audit"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not send a test post"),
  });
  const upcoming = (posts.data || []).filter((post) =>
    ["queued", "pending_review", "processing"].includes(post.status),
  );
  const rows = schedules.data || [];
  const accountName: Record<string, string> = {};
  for (const account of accounts.data || []) {
    const id = account.id || account._id;
    if (id) accountName[String(id)] = account.displayName;
  }

  return (
    <>
      <PageHeader
        eyebrow="Autopilot"
        title="Automation"
        description="Drafts stay saved. Open one to keep editing, or start it when the cadence looks right."
        actions={
          <Button asChild>
            <Link href="/app/automation/setup">
              <Plus className="size-4" />
              New automation
            </Link>
          </Button>
        }
      />
      <div className="mb-5 flex gap-2">
        {[
          ["automations", "Automations"],
          ["queue", "Queue"],
          ["activity", "Activity"],
        ].map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={tab === value ? "secondary" : "outline"}
            onClick={() => setTab(value as typeof tab)}
          >
            {label}
          </Button>
        ))}
      </div>
      {schedules.isLoading ? (
        <PageLoader />
      ) : tab === "automations" ? (
        rows.length ? (
          <div className="overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-180 text-left text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Automation</th>
                  <th className="px-4 py-3 font-medium">Country</th>
                  <th className="px-4 py-3 font-medium">Language</th>
                  <th className="px-4 py-3 font-medium">Cadence</th>
                  <th className="px-4 py-3 font-medium">Times</th>
                  <th className="px-4 py-3 font-medium">Publish to</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3 font-medium text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const id = scheduleId(item);
                  const account = item.socialAccountIds?.[0];
                  return (
                    <tr key={id} className="border-t">
                      <td className="px-4 py-3">
                        <Link href={`/app/automation/setup?id=${id}`} className="font-semibold hover:text-primary">
                          {item.name}
                        </Link>
                        <p className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground">
                          {item.websiteUrl || "No website yet"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.targetCountry || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.language || "English"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.cadence ? `${item.postsPerPeriod}× ${item.cadence}` : titleCase(item.mode)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {item.timesOfDay?.length ? item.timesOfDay.join(", ") : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {account ? accountName[String(account)] || "—" : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            item.status === "active"
                              ? "success"
                              : item.status === "draft"
                                ? "secondary"
                                : "warning"
                          }
                        >
                          {titleCase(item.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(item.updatedAt || item.createdAt, true)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={Boolean(testPost.isPending && testPost.variables && scheduleId(testPost.variables) === id)}
                            onClick={() => testPost.mutate(item)}
                          >
                            {testPost.isPending && testPost.variables && scheduleId(testPost.variables) === id ? (
                              <LoaderCircle className="size-3.5 animate-spin" />
                            ) : (
                              <Send className="size-3.5" />
                            )}
                            Test post
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="outline" aria-label="More actions">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/app/automation/setup?id=${id}`}>
                                  <Pencil className="size-4" />
                                  {item.status === "draft" ? "Continue draft" : "Edit"}
                                </Link>
                              </DropdownMenuItem>
                              {item.status !== "draft" && (
                                <DropdownMenuItem onSelect={() => toggle.mutate(item)}>
                                  {item.status === "active" ? (
                                    <Pause className="size-4" />
                                  ) : (
                                    <Play className="size-4" />
                                  )}
                                  {item.status === "active" ? "Pause" : "Resume"}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => confirm("Delete this automation?") && remove.mutate(item)}
                              >
                                <Trash2 className="size-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No automations yet"
            description="Paste your site, save a draft, then choose how often Swiply should post."
            icon={Sparkles}
            action={
              <Button asChild>
                <Link href="/app/automation/setup">
                  <Plus className="size-4" />
                  New automation
                </Link>
              </Button>
            }
          />
        )
      ) : tab === "queue" ? (
        upcoming.length ? (
          <div className="grid gap-4">
            {upcoming.map((post) => (
              <Card key={post.id || post._id}>
                <CardContent className="flex items-center gap-3 pt-5">
                  <span className="grid size-10 place-items-center rounded-xl bg-secondary/10 text-secondary">
                    <CalendarClock className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">TikTok slideshow</p>
                    <p className="text-xs text-muted-foreground">{formatDate(post.scheduledFor, true)}</p>
                  </div>
                  <Badge variant="secondary">{titleCase(post.status)}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setPreview({ contentId: post.contentId, scheduledFor: post.scheduledFor })
                    }
                  >
                    Preview
                  </Button>
                </CardContent>
              </Card>
            ))}
            {(content.data || []).slice(0, 6).length > 0 && (
              <div className="grid gap-4 sm:grid-cols-3">
                {(content.data || []).slice(0, 6).map((item) => {
                  const id = item.id || item._id || "";
                  return (
                    <button
                      key={id}
                      type="button"
                      className="text-left"
                      onClick={() => setPreview({ contentId: id })}
                    >
                      <Card className="overflow-hidden">
                        <div className="aspect-9/12 bg-muted">
                          {item.slideshow?.slides[0]?.imageUrl ? (
                            <img
                              src={item.slideshow.slides[0].imageUrl}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : null}
                        </div>
                        <CardContent className="pt-4">
                          <p className="line-clamp-2 text-sm font-semibold">{item.postCaption}</p>
                        </CardContent>
                      </Card>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            title="Nothing queued"
            description="Start an automation to generate randomized TikTok slideshows and schedule them."
            icon={CalendarClock}
          />
        )
      ) : audit.isError ? (
        <EmptyState
          title="Activity will appear here"
          description="Every research run, generated slideshow, and pause is recorded."
          icon={Clock3}
        />
      ) : (
        <div className="space-y-3">
          {(audit.data || []).map((item, index) => (
            <Card key={item.id || index}>
              <CardContent className="pt-5">
                <p className="text-sm font-semibold">{item.summary}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {titleCase(item.action)} · {formatDate(item.createdAt, true)}
                </p>
              </CardContent>
            </Card>
          ))}
          {!audit.data?.length && (
            <EmptyState title="No activity yet" description="Save a draft or start an automation to see the trail." icon={Clock3} />
          )}
        </div>
      )}
      <SlideshowPreviewDialog
        contentId={preview?.contentId || null}
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        scheduledFor={preview?.scheduledFor}
        platform="tiktok"
      />
    </>
  );
}
