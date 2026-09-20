"use client";
/* The settings link is rendered inside a compact validation notice. */
/* eslint-disable @next/next/no-html-link-for-pages */
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  CalendarClock,
  ImageIcon,
  Layers3,
  LoaderCircle,
  MessageSquareText,
  Sparkles,
  Upload,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useWorkspace } from "@/components/app/app-shell";
import {
  FormInput,
  FormSelect,
  FormTextarea,
} from "@/components/forms/form-fields";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, json } from "@/lib/api";
import type {
  AiCredential,
  AiModel,
  ContentItem,
  MediaAsset,
  SocialAccount,
} from "@/lib/types";
import { cn, titleCase } from "@/lib/utils";
type Values = {
  type: "post" | "slideshow" | "video";
  mode: "ai" | "manual";
  topic: string;
  targetCountry: string;
  goal: string;
  socialAccountId: string;
  scheduleSocialAccountId: string;
  scheduledFor: string;
  aiModel: string;
  imageSource: "user_provided" | "ai_generated";
  slideCount: number;
  text: string;
  postCaption: string;
  hashtags: string;
};
const goals = [
  "conversions",
  "awareness",
  "engagement",
  "traffic",
  "lead_gen",
  "community",
  "announcement",
];
const countries = [
  ["", "Global / no specific country"],
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["CA", "Canada"],
  ["AU", "Australia"],
  ["NG", "Nigeria"],
  ["ZA", "South Africa"],
  ["GH", "Ghana"],
  ["KE", "Kenya"],
  ["IN", "India"],
  ["BR", "Brazil"],
  ["DE", "Germany"],
  ["FR", "France"],
  ["MX", "Mexico"],
  ["JP", "Japan"],
];
function nextHourForInput() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}
export function ContentCreator() {
  const router = useRouter();
  const { workspace } = useWorkspace();
  const [selectedMedia, setSelectedMedia] = useState<string[]>([]);
  const [scheduleAfterCreate, setScheduleAfterCreate] = useState(false);
  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    defaultValues: {
      type: "post",
      mode: "ai",
      goal: "engagement",
      imageSource: "user_provided",
      slideCount: 3,
      hashtags: "",
      targetCountry: "",
      scheduleSocialAccountId: "",
      scheduledFor: nextHourForInput(),
    },
  });
  const type = watch("type"),
    mode = watch("mode"),
    source = watch("imageSource"),
    slideCount = Number(watch("slideCount")),
    scheduleAccountId = watch("scheduleSocialAccountId");
  const media = useQuery({
    queryKey: ["creator-media", workspace?.id],
    queryFn: () =>
      api<MediaAsset[]>(
        `/media?type=${type === "video" ? "video" : "image"}`,
        {},
        workspace?.id,
      ),
    enabled: !!workspace,
  });
  const accounts = useQuery({
    queryKey: ["creator-accounts", workspace?.id],
    queryFn: () => api<SocialAccount[]>("/social-accounts", {}, workspace?.id),
    enabled: !!workspace,
  });
  const models = useQuery({
    queryKey: ["ai-models"],
    queryFn: () => api<AiModel[]>("/ai/models"),
  });
  const credentials = useQuery({
    queryKey: ["ai-credentials"],
    queryFn: () => api<AiCredential[]>("/ai/credentials"),
  });
  const save = useMutation({
    mutationFn: async (values: Values) => {
      const payload = {
        type: values.type,
        topic: values.topic || undefined,
        targetCountry: values.targetCountry || undefined,
        goal: values.goal || undefined,
        socialAccountId: values.socialAccountId || undefined,
        aiModel: values.aiModel || undefined,
        text: values.text || undefined,
        postCaption: values.postCaption || undefined,
        hashtags: values.hashtags
          .split(/[\s,]+/)
          .filter(Boolean)
          .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)),
        slideCount:
          values.type === "slideshow" ? Number(values.slideCount) : undefined,
        imageSource: values.type === "video" ? undefined : values.imageSource,
        providedImageUrls:
          values.type !== "video" && values.imageSource === "user_provided"
            ? selectedMedia
            : undefined,
        providedVideoUrl:
          values.type === "video" ? selectedMedia[0] : undefined,
      };
      const item = await api<ContentItem>(
        values.mode === "ai" ? "/content/generate" : "/content",
        { method: "POST", ...json(payload) },
        workspace?.id,
      );
      const contentId = item.id || item._id;
      if (scheduleAfterCreate && values.scheduleSocialAccountId && contentId) {
        await api(
          "/posts",
          {
            method: "POST",
            ...json({
              contentId,
              socialAccountId: values.scheduleSocialAccountId,
              scheduledFor: new Date(values.scheduledFor).toISOString(),
            }),
          },
          workspace?.id,
        );
        return { item, scheduled: true };
      }
      return { item, scheduled: false };
    },
    onSuccess: ({ item, scheduled }) => {
      const contentId = item.id || item._id;
      if (scheduled) {
        toast.success("Content created and scheduled");
        router.push("/app/calendar");
        return;
      }
      toast.success("Content created");
      router.push(`/app/content/${contentId}`);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not create content",
      ),
  });
  const expected = type === "slideshow" ? slideCount : 1;
  const mediaRequired =
    type === "video" || type === "slideshow" || mode === "manual";
  const missingRequiredMedia =
    mediaRequired && selectedMedia.length !== expected;
  const missingScheduleDetails =
    scheduleAfterCreate && (!scheduleAccountId || !watch("scheduledFor"));
  function toggleMedia(url: string) {
    setSelectedMedia((current) =>
      current.includes(url)
        ? current.filter((x) => x !== url)
        : current.length < expected
          ? [...current, url]
          : [...current.slice(1), url],
    );
  }
  return (
    <>
      <PageHeader
        eyebrow="Creator studio"
        title="Make something worth stopping for."
        description="Choose the format, give Swiply direction, then review everything before it publishes."
      />
      <form
        onSubmit={handleSubmit((v) => save.mutate(v))}
        className="grid gap-6 xl:grid-cols-[1fr_360px]"
      >
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-5">
              <p className="mb-3 text-sm font-semibold">1. Choose a format</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  [
                    "post",
                    MessageSquareText,
                    "Post",
                    "A caption with one image",
                  ],
                  [
                    "slideshow",
                    Layers3,
                    "Slideshow",
                    "A swipeable visual story",
                  ],
                  ["video", Video, "Video", "Upload a finished video"],
                ].map(([value, Icon, label, body]) => (
                  <button
                    key={String(value)}
                    type="button"
                    onClick={() => {
                      setValue("type", value as Values["type"]);
                      setSelectedMedia([]);
                    }}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition",
                      type === value
                        ? "border-primary bg-primary/5 ring-2 ring-primary/10"
                        : "hover:bg-muted",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-5",
                        type === value
                          ? "text-primary"
                          : "text-muted-foreground",
                      )}
                    />
                    <p className="mt-4 text-sm font-bold">{String(label)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {String(body)}
                    </p>
                  </button>
                ))}
              </div>
              <div className="mt-5 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "ai" ? "secondary" : "outline"}
                  onClick={() => setValue("mode", "ai")}
                >
                  <Sparkles className="size-4" />
                  AI assisted
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "manual" ? "secondary" : "outline"}
                  onClick={() => setValue("mode", "manual")}
                >
                  Write manually
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="grid gap-5 pt-5 sm:grid-cols-2">
              {mode === "ai" ? (
                <>
                  <FormTextarea
                    className="sm:col-span-2"
                    name="topic"
                    label="What should this be about?"
                    placeholder="A practical lesson, launch, story, or idea…"
                    maxLength={5000}
                    register={register}
                    required
                    rules={{ required: "Tell us what to create" }}
                    error={errors.topic?.message}
                  />
                  <FormSelect
                    name="goal"
                    label="Primary goal"
                    register={register}
                    options={goals.map((x) => ({
                      value: x,
                      label: titleCase(x),
                    }))}
                  />
                  <FormSelect
                    name="targetCountry"
                    label="Target country"
                    register={register}
                    options={countries.map(([value, label]) => ({
                      value,
                      label,
                    }))}
                  />
                  <FormSelect
                    name="socialAccountId"
                    label="Write in this voice"
                    register={register}
                    options={[
                      { value: "", label: "Neutral brand voice" },
                      ...(accounts.data || []).map((a) => ({
                        value: a.id,
                        label: `${a.displayName} · ${titleCase(a.platform)}`,
                      })),
                    ]}
                  />
                  {credentials.data?.length === 0 && (
                    <div className="sm:col-span-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
                      <strong>Add an AI key first.</strong> Your personal
                      provider key is required for generation.{" "}
                      <a
                        href="/app/settings/ai"
                        className="text-primary underline"
                      >
                        Open AI settings
                      </a>
                    </div>
                  )}
                  <FormSelect
                    name="aiModel"
                    label="AI model"
                    register={register}
                    options={[
                      { value: "", label: "Use my default" },
                      ...(models.data || []).map((m) => ({
                        value: m.id,
                        label: m.name,
                      })),
                    ]}
                  />
                  {type === "slideshow" && (
                    <FormInput
                      name="slideCount"
                      type="number"
                      min={2}
                      max={35}
                      label="Number of slides"
                      register={register}
                    />
                  )}
                </>
              ) : (
                <>
                  <FormTextarea
                    className="sm:col-span-2"
                    name="text"
                    label={type === "video" ? "Video caption" : "Post text"}
                    placeholder="Write your message…"
                    maxLength={2200}
                    register={register}
                  />
                  <FormInput
                    className="sm:col-span-2"
                    name="hashtags"
                    label="Hashtags"
                    description="Separate tags with spaces or commas."
                    placeholder="#creator #socialmedia"
                    register={register}
                  />
                </>
              )}
            </CardContent>
          </Card>
          {
            <Card>
              <CardContent className="pt-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      2. Choose {type === "video" ? "a video" : "visuals"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {type === "video"
                        ? "Select one finished video from your media library."
                        : `Select ${expected} image${expected === 1 ? "" : "s"} in publishing order.`}
                    </p>
                  </div>
                  {type !== "video" && <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        source === "user_provided" ? "secondary" : "outline"
                      }
                      onClick={() => setValue("imageSource", "user_provided")}
                    >
                      <Upload className="size-3.5" />
                      My media
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        source === "ai_generated" ? "secondary" : "outline"
                      }
                      onClick={() => setValue("imageSource", "ai_generated")}
                    >
                      <Sparkles className="size-3.5" />
                      AI images
                    </Button>
                  </div>}
                </div>
                {(type === "video" || source === "user_provided") &&
                  (media.data?.length ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {media.data.map((asset) => (
                        <button
                          type="button"
                          key={asset.id || asset._id}
                          onClick={() => toggleMedia(asset.url)}
                          className={cn(
                            "relative aspect-square overflow-hidden rounded-xl border-2",
                            selectedMedia.includes(asset.url)
                              ? "border-primary"
                              : "border-transparent",
                          )}
                        >
                          {asset.type === "video" ? (
                            <span className="grid size-full place-items-center bg-muted">
                              <Video className="size-9 text-primary" />
                              <span className="sr-only">{asset.fileName || "Video"}</span>
                            </span>
                          ) : (
                            <img
                              src={asset.url}
                              alt={asset.fileName || "Media asset"}
                              className="size-full object-cover"
                            />
                          )}
                          {selectedMedia.includes(asset.url) && (
                            <Badge className="absolute left-2 top-2">
                              {selectedMedia.indexOf(asset.url) + 1}
                            </Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="grid min-h-40 place-items-center rounded-xl border border-dashed text-center">
                      <div>
                        {type === "video" ? <Video className="mx-auto size-6 text-muted-foreground" /> : <ImageIcon className="mx-auto size-6 text-muted-foreground" />}
                        <p className="mt-2 text-sm">
                          Upload {type === "video" ? "a video" : "images"} in the media library first.
                        </p>
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          }
        </div>
        <aside>
          <Card className="sticky top-24">
            <CardContent className="pt-5">
              <p className="text-sm font-semibold">Ready to create?</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Nothing publishes automatically. You’ll review the result and
                choose a destination and time next.
              </p>
              <div className="mt-5 space-y-2 rounded-xl bg-muted p-3 text-xs">
                <div className="flex justify-between">
                  <span>Format</span>
                  <strong>{titleCase(type)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Method</span>
                  <strong>{mode === "ai" ? "AI assisted" : "Manual"}</strong>
                </div>
                {(type === "video" || source === "user_provided") && (
                  <div className="flex justify-between">
                    <span>Media</span>
                    <strong>
                      {selectedMedia.length}/{expected}
                    </strong>
                  </div>
                )}
              </div>
              {missingRequiredMedia && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {type === "video"
                    ? "Select one video before creating content."
                    : type === "slideshow"
                      ? `Select ${expected} images before generating a slideshow.`
                      : "Select an image or switch to AI mode for a text-only post."}
                </p>
              )}
              <div className="mt-5 rounded-xl border p-3">
                <Button
                  type="button"
                  variant={scheduleAfterCreate ? "secondary" : "outline"}
                  size="sm"
                  className="w-full"
                  onClick={() => setScheduleAfterCreate((current) => !current)}
                >
                  <CalendarClock className="size-4" />
                  {scheduleAfterCreate ? "Scheduling enabled" : "Schedule after create"}
                </Button>
                {scheduleAfterCreate && (
                  <div className="mt-4 space-y-4">
                    <FormSelect
                      name="scheduleSocialAccountId"
                      label="Destination"
                      register={register}
                      required
                      options={[
                        { value: "", label: "Choose account" },
                        ...(accounts.data || [])
                          .filter((account) => account.status === "active")
                          .map((account) => ({
                            value: account.id,
                            label: `${account.displayName} · ${titleCase(account.platform)}`,
                          })),
                      ]}
                    />
                    <FormInput
                      name="scheduledFor"
                      type="datetime-local"
                      label="Publish time"
                      register={register}
                      required
                    />
                  </div>
                )}
              </div>
              <Button
                type="submit"
                className="mt-5 w-full"
                size="lg"
                disabled={save.isPending || missingRequiredMedia || missingScheduleDetails}
              >
                {save.isPending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {mode === "ai"
                  ? scheduleAfterCreate
                    ? "Generate and schedule"
                    : "Generate content"
                  : scheduleAfterCreate
                    ? "Create and schedule"
                    : "Create draft"}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </form>
    </>
  );
}
