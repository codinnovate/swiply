"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  Globe,
  ImageIcon,
  LoaderCircle,
  Search,
  Sparkles,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/components/app/app-shell";
import { FormInput, FormSelect } from "@/components/forms/form-fields";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, json } from "@/lib/api";
import type {
  AiCredential,
  BrandResearch,
  MediaAsset,
  PostingTimeSuggestion,
  Schedule,
  SocialAccount,
} from "@/lib/types";
import { cn, titleCase } from "@/lib/utils";

type Cadence = "daily" | "weekly";
type Values = {
  websiteUrl: string;
  socialAccountId: string;
  cadence: Cadence;
  postsPerPeriod: number;
  targetCountry: string;
  language: string;
  times: string[];
};

const TIME_LABELS = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh"];
const PEAK_WINDOWS = ["07:00", "12:15", "17:00", "19:00", "21:30", "08:45", "15:30"];
const COUNTRIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "India",
  "Germany",
  "France",
  "Brazil",
  "Mexico",
  "Japan",
  "South Korea",
  "Indonesia",
  "Philippines",
  "Nigeria",
  "South Africa",
  "United Arab Emirates",
  "Spain",
  "Italy",
  "Netherlands",
  "Ireland",
];
const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Italian",
  "Dutch",
  "Polish",
  "Turkish",
  "Arabic",
  "Hindi",
  "Japanese",
  "Korean",
  "Chinese (Simplified)",
  "Chinese (Traditional)",
  "Indonesian",
  "Vietnamese",
  "Thai",
  "Russian",
  "Swedish",
  "Norwegian",
  "Danish",
  "Finnish",
  "Greek",
  "Hebrew",
  "Ukrainian",
  "Romanian",
  "Czech",
  "Hungarian",
  "Malay",
  "Filipino",
];

function padTimes(times: string[], count: number) {
  const size = Math.min(7, Math.max(1, count));
  const next = times.filter(Boolean).slice(0, size);
  for (const peak of PEAK_WINDOWS) {
    if (next.length >= size) break;
    if (!next.includes(peak)) next.push(peak);
  }
  return next;
}

function researchFromSchedule(item: Schedule): BrandResearch | null {
  const stored = item.brandResearch;
  if (stored?.websiteBrief && stored.tiktokInsights) return stored;
  if (item.websiteBrief && item.tiktokInsights) {
    return {
      productName: item.name.replace(/ TikTok slideshows$/i, "") || "Product",
      oneLiner: item.websiteBrief.slice(0, 180),
      audience: "",
      valueProps: [],
      websiteBrief: item.websiteBrief,
      tiktokInsights: item.tiktokInsights,
      suggestedAngles: [],
      competitors: [],
      competitorAccounts: [],
      websiteUrl: item.websiteUrl || "",
    };
  }
  return null;
}

const steps = [
  ["Site", "Product + competitors"],
  ["Cadence", "How often it posts"],
] as const;

export function AutomationSetup() {
  const router = useRouter();
  const params = useSearchParams();
  const { workspace } = useWorkspace();
  const requestedId = params.get("id");
  const scheduleId = useRef(requestedId);
  const [step, setStep] = useState(0);
  const [research, setResearch] = useState<BrandResearch | null>(null);
  const [timeZone, setTimeZone] = useState("");
  const [rationale, setRationale] = useState("");
  const [status, setStatus] = useState("draft");
  const {
    register,
    control,
    watch,
    setValue,
    getValues,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    defaultValues: {
      websiteUrl: "https://",
      socialAccountId: "",
      cadence: "daily",
      postsPerPeriod: 1,
      targetCountry: "United States",
      language: "English",
      times: ["07:00"],
    },
  });
  const cadence = watch("cadence");
  const postsPerPeriod = Number(watch("postsPerPeriod")) || 1;
  const targetCountry = watch("targetCountry");
  const language = watch("language");
  const times = watch("times");
  const existing = useQuery({
    queryKey: ["automation-schedule", workspace?.id, requestedId],
    queryFn: () => api<Schedule>(`/schedules/${requestedId}`, {}, workspace?.id),
    enabled: !!workspace && !!requestedId,
  });
  const accounts = useQuery({
    queryKey: ["automation-accounts", workspace?.id],
    queryFn: () => api<SocialAccount[]>("/social-accounts", {}, workspace?.id),
    enabled: !!workspace,
  });
  const media = useQuery({
    queryKey: ["automation-media", workspace?.id],
    queryFn: () => api<MediaAsset[]>("/media?type=image", {}, workspace?.id),
    enabled: !!workspace,
  });
  const credentials = useQuery({
    queryKey: ["ai-credentials"],
    queryFn: () => api<AiCredential[]>("/ai/credentials"),
  });
  const tiktokAccounts = (accounts.data || []).filter(
    (account) => account.platform === "tiktok" && account.status === "active",
  );
  const imageCount = (media.data || []).length;
  const hasLibrary = imageCount >= 2;
  const isLive = status === "active" || status === "paused";

  useEffect(() => {
    const item = existing.data;
    if (!item) return;
    const id = item.id || item._id || "";
    scheduleId.current = id;
    const loaded = researchFromSchedule(item);
    setResearch(loaded);
    setStatus(item.status);
    setTimeZone(item.postingTimeZone || "");
    reset({
      websiteUrl: item.websiteUrl || "https://",
      socialAccountId: item.socialAccountIds?.[0] || "",
      cadence: item.cadence || "daily",
      postsPerPeriod: item.postsPerPeriod || 1,
      targetCountry: item.targetCountry || "United States",
      language: item.language || "English",
      times: padTimes(item.timesOfDay || [], item.postsPerPeriod || 1),
    });
    setStep(loaded ? 1 : 0);
  }, [existing.data, reset]);

  useEffect(() => {
    const current = getValues("times") || [];
    if (current.length === postsPerPeriod) return;
    setValue("times", padTimes(current, postsPerPeriod));
  }, [getValues, postsPerPeriod, setValue]);

  function draftBody(values: Values, learned: BrandResearch | null = research) {
    return {
      ...(scheduleId.current ? { scheduleId: scheduleId.current } : {}),
      websiteUrl: values.websiteUrl.trim(),
      websiteBrief: learned?.websiteBrief,
      tiktokInsights: learned?.tiktokInsights,
      productName: learned?.productName,
      oneLiner: learned?.oneLiner,
      suggestedAngles: learned?.suggestedAngles,
      competitors: learned?.competitors,
      competitorAccounts: learned?.competitorAccounts,
      audience: learned?.audience,
      valueProps: learned?.valueProps,
      ...(values.socialAccountId ? { socialAccountId: values.socialAccountId } : {}),
      cadence: values.cadence,
      postsPerPeriod: Number(values.postsPerPeriod) || 1,
      timesOfDay: padTimes(values.times || [], Number(values.postsPerPeriod) || 1),
      targetCountry: values.targetCountry,
      language: values.language,
      ...(timeZone ? { timeZone } : {}),
    };
  }

  const saveDraft = useMutation({
    mutationFn: ({ values, learned }: { values: Values; learned?: BrandResearch | null }) =>
      api<Schedule>(
        "/automation/draft",
        { method: "POST", ...json(draftBody(values, learned ?? research)) },
        workspace?.id,
      ),
    onSuccess: (item) => {
      const id = item.id || item._id || "";
      scheduleId.current = id;
      setStatus(item.status);
      if (id && params.get("id") !== id) router.replace(`/app/automation/setup?id=${id}`);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save draft"),
  });

  const researchBrand = useMutation({
    mutationFn: (values: Values) =>
      api<BrandResearch>(
        "/automation/research",
        { method: "POST", ...json({ websiteUrl: values.websiteUrl.trim() }) },
        workspace?.id,
      ),
    onSuccess: (result, values) => {
      setResearch(result);
      toast.success(`Learned ${result.productName}`);
      setStep(1);
      saveDraft.mutate({ values: { ...values, ...getValues() }, learned: result });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not read that site"),
  });

  const suggestTimes = useMutation({
    mutationFn: (values: Values) =>
      api<PostingTimeSuggestion>(
        "/automation/posting-times",
        {
          method: "POST",
          ...json({
            cadence: values.cadence,
            postsPerPeriod: Number(values.postsPerPeriod) || 1,
            targetCountry: values.targetCountry,
            tiktokInsights: research?.tiktokInsights,
            timeZone: workspace?.timezone,
          }),
        },
        workspace?.id,
      ),
    onSuccess: (result) => {
      setValue("times", padTimes(result.times, postsPerPeriod));
      setTimeZone(result.timeZone);
      setRationale(result.rationale);
      toast.success("Suggested times for that market");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not suggest times"),
  });

  const start = useMutation({
    mutationFn: (values: Values) =>
      api(
        "/automation/start",
        {
          method: "POST",
          ...json({
            ...draftBody(values),
            socialAccountId: values.socialAccountId,
            cadence: values.cadence,
            postsPerPeriod: Number(values.postsPerPeriod) || 1,
            timesOfDay: padTimes(values.times || [], Number(values.postsPerPeriod) || 1),
          }),
        },
        workspace?.id,
      ),
    onSuccess: () => {
      toast.success(isLive ? "Automation updated" : "TikTok slideshows are queued");
      router.push("/app/automation");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not start automation"),
  });

  return (
    <>
      <PageHeader
        eyebrow="Automation"
        title={isLive ? "Edit this automation." : "Post TikTok slideshows on autopilot."}
        description="Research, cadence, and times are saved as a draft. Come back anytime — you do not start from scratch."
      />
      <div className="mb-6 flex gap-2">
        {steps.map(([label, hint], index) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(index)}
            className={cn(
              "flex-1 rounded-2xl border px-4 py-3 text-left",
              step === index ? "border-primary bg-primary/5" : "hover:bg-muted",
            )}
          >
            <p className="text-sm font-semibold">
              {index + 1}. {label}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </button>
        ))}
      </div>
      <form
        onSubmit={handleSubmit((values) => {
          if (step === 0) {
            if (!research) {
              researchBrand.mutate(values);
              return;
            }
            setStep(1);
            return;
          }
          if (!hasLibrary) {
            toast.error("Upload at least two images to the media library first");
            return;
          }
          start.mutate(values);
        })}
        className="grid gap-6 xl:grid-cols-[1fr_340px]"
      >
        <div className="space-y-6">
          {step === 0 && (
            <Card>
              <CardContent className="grid gap-5 pt-5">
                <FormInput
                  name="websiteUrl"
                  label="Business website"
                  placeholder="https://yourproduct.com"
                  register={register}
                  required
                  rules={{ required: "Paste your product URL" }}
                  error={errors.websiteUrl?.message}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  After it understands the product, the AI searches TikTok for competitors in that niche. Connect a TikTok account later, only to publish.
                </p>
                {credentials.data?.length === 0 && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
                    Add an AI key in{" "}
                    <Link href="/app/settings/ai" className="text-primary underline">
                      AI settings
                    </Link>{" "}
                    so Swiply can read the site, study competitors on TikTok, and write the slides.
                  </div>
                )}
                {!hasLibrary && (
                  <div className="rounded-xl border border-dashed p-4 text-sm">
                    <div className="flex items-start gap-3">
                      <ImageIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div>
                        <p>Upload at least two images to the media library. Each slideshow picks from those automatically.</p>
                        <Button asChild variant="outline" size="sm" className="mt-3">
                          <Link href="/app/media">Open media library</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                {research && (
                  <div className="space-y-3 rounded-2xl bg-muted p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">{research.productName}</p>
                      <Badge>{titleCase("learned")}</Badge>
                    </div>
                    <p className="text-sm leading-6">{research.oneLiner}</p>
                    {!!research.competitors?.length && (
                      <p className="text-xs leading-5 text-muted-foreground">
                        Competitors: {research.competitors.join(", ")}
                      </p>
                    )}
                    <p className="text-xs leading-5 text-muted-foreground">
                      {research.tiktokInsights}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          {step === 1 && (
            <Card>
              <CardContent className="grid gap-5 pt-5 sm:grid-cols-2">
                <div className="sm:col-span-2 flex gap-2">
                  {(["daily", "weekly"] as Cadence[]).map((value) => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={cadence === value ? "secondary" : "outline"}
                      onClick={() => setValue("cadence", value)}
                    >
                      {titleCase(value)}
                    </Button>
                  ))}
                </div>
                <FormSelect
                  name="targetCountry"
                  label="Target country"
                  description="Posting times are local to this market, not your laptop clock."
                  control={control}
                  required
                  rules={{ required: "Choose a country" }}
                  error={errors.targetCountry?.message}
                  className="sm:col-span-2"
                  options={COUNTRIES.map((country) => ({ value: country, label: country }))}
                />
                <FormSelect
                  name="language"
                  label="Language"
                  description="Slideshow captions, hooks, and hashtags will be written in this language."
                  control={control}
                  required
                  rules={{ required: "Choose a language" }}
                  error={errors.language?.message}
                  className="sm:col-span-2"
                  options={LANGUAGES.map((language) => ({ value: language, label: language }))}
                />
                <FormInput
                  name="postsPerPeriod"
                  type="number"
                  min={1}
                  max={7}
                  label={cadence === "daily" ? "Times per day" : "Times per week"}
                  register={register}
                />
                {tiktokAccounts.length === 0 && (
                  <div className="sm:col-span-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
                    Connect a TikTok account in{" "}
                    <Link href="/app/accounts" className="text-primary underline">
                      Accounts
                    </Link>{" "}
                    to publish. Research does not use your account.
                  </div>
                )}
                <FormSelect
                  name="socialAccountId"
                  label="Publish to"
                  description="Publishing only — research already ran against public TikTok, not this account."
                  control={control}
                  required
                  rules={{ required: "Choose a TikTok account" }}
                  error={errors.socialAccountId?.message}
                  options={[
                    { value: "", label: "Choose TikTok account" },
                    ...tiktokAccounts.map((account) => ({
                      value: account.id,
                      label: account.displayName,
                    })),
                  ]}
                />
                <div className="sm:col-span-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">Post times</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={suggestTimes.isPending || !targetCountry}
                    onClick={() => suggestTimes.mutate(getValues())}
                  >
                    {suggestTimes.isPending ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    Suggest for {targetCountry || "this country"}
                  </Button>
                </div>
                {Array.from({ length: postsPerPeriod }, (_, index) => (
                  <FormInput
                    key={index}
                    name={`times.${index}` as const}
                    type="time"
                    label={`${TIME_LABELS[index] || `Time ${index + 1}`} post`}
                    register={register}
                    required
                  />
                ))}
                {rationale && (
                  <p className="sm:col-span-2 text-xs leading-5 text-muted-foreground">{rationale}</p>
                )}
                {timeZone && (
                  <p className="sm:col-span-2 text-xs text-muted-foreground">
                    Times are {timeZone} local time.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
        <aside>
          <Card className="sticky top-24">
            <CardContent className="pt-5">
              <p className="text-sm font-semibold">What happens next</p>
              <ul className="mt-3 space-y-3 text-xs leading-5 text-muted-foreground">
                <li className="flex gap-2">
                  <Globe className="mt-0.5 size-4 shrink-0 text-primary" />
                  Read the website and turn it into a product brief.
                </li>
                <li className="flex gap-2">
                  <Search className="mt-0.5 size-4 shrink-0 text-primary" />
                  Search TikTok for how competitors in that niche are posting.
                </li>
                <li className="flex gap-2">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                  Each post randomly picks slides from your media library.
                </li>
                <li className="flex gap-2">
                  <Timer className="mt-0.5 size-4 shrink-0 text-primary" />
                  Saved as a draft until you start it. Slide count and order stay randomized.
                </li>
              </ul>
              <div className="mt-5 space-y-2 rounded-xl bg-muted p-3 text-xs">
                <div className="flex justify-between">
                  <span>Status</span>
                  <strong>{titleCase(status)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Media library</span>
                  <strong>
                    {imageCount} image{imageCount === 1 ? "" : "s"}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Language</span>
                  <strong>{language || "English"}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Cadence</span>
                  <strong>
                    {postsPerPeriod}× {cadence}
                  </strong>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Times</span>
                  <strong className="text-right">{(times || []).filter(Boolean).join(", ") || "—"}</strong>
                </div>
              </div>
              <div className="mt-5 flex flex-col gap-2">
                <div className="flex gap-2">
                  {step > 0 && (
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setStep((current) => current - 1)}>
                      Back
                    </Button>
                  )}
                  <Button className="flex-1" disabled={researchBrand.isPending || start.isPending}>
                    {(researchBrand.isPending || start.isPending) && (
                      <LoaderCircle className="size-4 animate-spin" />
                    )}
                    {step === 0
                      ? research
                        ? "Continue"
                        : "Study competitors"
                      : isLive
                        ? "Save changes"
                        : "Start automation"}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saveDraft.isPending}
                  onClick={() =>
                    saveDraft.mutate(
                      { values: getValues() },
                      {
                        onSuccess: () => toast.success("Draft saved"),
                      },
                    )
                  }
                >
                  {saveDraft.isPending && <LoaderCircle className="size-4 animate-spin" />}
                  Save draft
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>
      </form>
    </>
  );
}
