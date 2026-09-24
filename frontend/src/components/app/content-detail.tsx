"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarPlus, Copy, ImageIcon, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useWorkspace } from "@/components/app/app-shell";
import { FormInput, FormSelect } from "@/components/forms/form-fields";
import { TikTokSlideshowPreview } from "@/components/app/tiktok-slideshow-preview";
import { PageLoader, ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, json } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { ContentItem, ScheduledPost, SocialAccount } from "@/lib/types";
import { formatDate, titleCase } from "@/lib/utils";

type ScheduleValues = { socialAccountId: string; scheduledFor: string };

function nextHourForInput() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

export function ContentDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { workspace } = useWorkspace();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const item = useQuery({
    queryKey: ["content-detail", workspace?.id, id],
    queryFn: () => api<ContentItem>(`/content/${id}`, {}, workspace?.id),
    enabled: !!workspace,
  });
  const remove = useMutation({
    mutationFn: () =>
      api<void>(`/content/${id}`, { method: "DELETE" }, workspace?.id),
    onSuccess: () => {
      toast.success("Content deleted");
      qc.invalidateQueries({ queryKey: ["content"] });
      router.push("/app/content");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not delete content",
      ),
  });
  const duplicate = useMutation({
    mutationFn: () =>
      api<ContentItem>(
        `/content/${id}/duplicate`,
        { method: "POST" },
        workspace?.id,
      ),
    onSuccess: (copy) => {
      toast.success("Content duplicated");
      qc.invalidateQueries({ queryKey: ["content"] });
      router.push(`/app/content/${copy.id || copy._id}`);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not duplicate content",
      ),
  });
  if (item.isLoading) return <PageLoader />;
  if (item.isError || !item.data)
    return <ErrorState retry={() => item.refetch()} />;
  const x = item.data;
  const images =
    x.slideshow?.slides.map((s) => s.imageUrl) || x.post?.imageUrls || [];
  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <Button asChild variant="ghost">
          <Link href="/app/content">
            <ArrowLeft className="size-4" />
            Content
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={duplicate.isPending}
            onClick={() => duplicate.mutate()}
          >
            <Copy className="size-4" />
            {duplicate.isPending ? "Duplicating…" : "Duplicate"}
          </Button>
          <Button
            variant="destructive"
            onClick={() =>
              confirm("Delete this content permanently?") && remove.mutate()
            }
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
        <Card>
          <CardContent className="pt-5">
            {x.type === "slideshow" && x.slideshow?.slides.length ? (
              <TikTokSlideshowPreview
                slides={x.slideshow.slides}
                caption={x.postCaption}
                hashtags={x.hashtags}
              />
            ) : images.length ? (
              <div
                className={images.length > 1 ? "grid grid-cols-2 gap-3" : ""}
              >
                {images.map((src, i) => (
                  <div
                    key={src}
                    className="relative aspect-square overflow-hidden rounded-2xl bg-muted"
                  >
                    <img
                      src={src}
                      alt={x.slideshow?.slides[i]?.altText || "Content visual"}
                      className="size-full object-cover"
                    />
                    <Badge className="absolute left-3 top-3">{i + 1}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid aspect-video place-items-center rounded-2xl bg-muted">
                <ImageIcon className="size-10 text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge>{titleCase(x.type)}</Badge>
                <Badge variant="secondary">{titleCase(x.status)}</Badge>
              </div>
              <CardTitle className="pt-3">
                {x.postCaption || x.post?.text || "Untitled content"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6">{x.post?.text}</p>
              <p className="mt-4 text-sm text-primary">
                {x.hashtags.join(" ")}
              </p>
              <dl className="mt-6 grid grid-cols-2 gap-4 border-t pt-5 text-xs">
                <div>
                  <dt className="text-muted-foreground">Goal</dt>
                  <dd className="mt-1 font-semibold">
                    {titleCase(x.goal || "None")}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Created</dt>
                  <dd className="mt-1 font-semibold">
                    {formatDate(x.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Source</dt>
                  <dd className="mt-1 font-semibold">
                    {titleCase(x.generationSource)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Model</dt>
                  <dd className="mt-1 font-semibold">{x.aiModel || "—"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          <Button
            className="w-full"
            size="lg"
            onClick={() => setScheduleOpen(true)}
          >
            <CalendarPlus className="size-4" />
            Schedule this content
          </Button>
        </div>
      </div>
      <ScheduleContentDialog
        contentId={id}
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
      />
    </>
  );
}

function ScheduleContentDialog({
  contentId,
  open,
  onOpenChange,
}: {
  contentId: string;
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [minimumDate] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
  });
  const accounts = useQuery({
    queryKey: queryKeys.accounts(workspace?.id || ""),
    queryFn: () => api<SocialAccount[]>("/social-accounts", {}, workspace?.id),
    enabled: !!workspace && open,
  });
  const activeAccounts = (accounts.data || []).filter(
    (account) => account.status === "active",
  );
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ScheduleValues>({
    defaultValues: { socialAccountId: "", scheduledFor: nextHourForInput() },
  });
  const schedule = useMutation({
    mutationFn: (values: ScheduleValues) =>
      api<ScheduledPost>(
        "/posts",
        {
          method: "POST",
          ...json({
            contentId,
            socialAccountId: values.socialAccountId,
            scheduledFor: new Date(values.scheduledFor).toISOString(),
          }),
        },
        workspace?.id,
      ),
    onSuccess: () => {
      toast.success("Content scheduled");
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      reset({ socialAccountId: "", scheduledFor: nextHourForInput() });
      onOpenChange(false);
      router.push("/app/calendar");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not schedule content",
      ),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule content</DialogTitle>
          <DialogDescription>
            Choose a direct account or a channel imported from Buffer or Postiz.
            Provider-connected posts are handed off immediately for delivery.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={handleSubmit((values) => schedule.mutate(values))}
        >
          <FormSelect
            name="socialAccountId"
            label="Publishing account"
            required
            control={control}
            rules={{ required: "Choose a publishing account" }}
            error={errors.socialAccountId?.message}
            disabled={accounts.isLoading || schedule.isPending}
            options={[
              {
                value: "",
                label: accounts.isLoading
                  ? "Loading accounts…"
                  : "Choose an account",
              },
              ...activeAccounts.map((account) => ({
                value: account.id,
                label: `${account.displayName} · ${titleCase(account.platform)} · ${titleCase(account.connectionProvider)}`,
              })),
            ]}
          />
          {!accounts.isLoading && activeAccounts.length === 0 && (
            <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
              No active publishing accounts. Connect a direct account or import
              a Buffer/Postiz channel from Accounts first.
            </p>
          )}
          <FormInput
            name="scheduledFor"
            label="Publish date and time"
            type="datetime-local"
            required
            register={register}
            rules={{
              required: "Choose a publish time",
              validate: (value) =>
                new Date(value).getTime() > Date.now() ||
                "Choose a future time",
            }}
            error={errors.scheduledFor?.message}
            min={minimumDate}
            disabled={schedule.isPending}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={schedule.isPending || !activeAccounts.length}
            >
              {schedule.isPending ? "Scheduling…" : "Schedule post"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
