"use client";
/* OAuth handoff intentionally navigates the top-level browser location. */
/* eslint-disable react-hooks/immutability */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Link2, MessageCircle, Settings2, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useWorkspace } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { FormInput, FormSelect } from "@/components/forms/form-fields";
import { PageLoader } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import type { PlatformAvailability, SocialAccount } from "@/lib/types";
import { titleCase } from "@/lib/utils";
import { ProviderConnections } from "@/components/app/provider-connections";
const platformStyle: Record<string, string> = {
  instagram: "from-fuchsia-500 to-orange-400",
  tiktok: "from-slate-900 to-cyan-400",
  twitter: "from-sky-500 to-sky-600",
  facebook: "from-blue-600 to-blue-500",
  linkedin: "from-blue-800 to-blue-600",
  pinterest: "from-red-600 to-red-500",
};
export function AccountsView() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  const [defaultsAccount, setDefaultsAccount] = useState<SocialAccount | null>(
    null,
  );
  const accounts = useQuery({
    queryKey: queryKeys.accounts(workspace?.id || ""),
    queryFn: () => api<SocialAccount[]>("/social-accounts", {}, workspace?.id),
    enabled: !!workspace,
  });
  const platforms = useQuery({
    queryKey: queryKeys.platforms(workspace?.id || ""),
    queryFn: () =>
      api<PlatformAvailability[]>(
        "/social-accounts/platforms",
        {},
        workspace?.id,
      ),
    enabled: !!workspace,
  });
  const disconnect = useMutation({
    mutationFn: (id: string) =>
      api(`/social-accounts/${id}`, { method: "DELETE" }, workspace?.id),
    onSuccess: () => {
      toast.success("Account disconnected");
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
  async function connect(platform: string) {
    try {
      const result = await api<{ authorizeUrl: string }>(
        `/social-accounts/connect/${platform}`,
        {},
        workspace?.id,
      );
      location.href = result.authorizeUrl;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not connect");
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Channels"
        title="Social accounts"
        description="Connect the profiles you create for, inspect their health, and teach Swiply how each one sounds."
      />
      <ProviderConnections />
      {accounts.isLoading ? (
        <PageLoader />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {accounts.data?.map((account) => (
            <Card key={account.id}>
              <CardContent className="flex items-center gap-4 pt-5">
                <span
                  className={`grid size-12 place-items-center rounded-2xl bg-gradient-to-br ${platformStyle[account.platform]} text-sm font-bold text-white`}
                >
                  {account.displayName.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold">
                      {account.displayName}
                    </p>
                    <Badge
                      variant={
                        account.status === "active" ? "success" : "destructive"
                      }
                    >
                      {account.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {titleCase(account.platform)} ·{" "}
                    {titleCase(account.connectionProvider || "direct")} ·{" "}
                    {account.voiceProfileId
                      ? "Voice learned"
                      : "Voice not learned"}
                  </p>
                  {account.lastError && (
                    <p className="mt-1 truncate text-xs text-destructive">
                      {account.lastError}
                    </p>
                  )}
                </div>
                <div className="flex">
                  {(account.connectionProvider || "direct") !== "direct" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Publishing defaults"
                      onClick={() => setDefaultsAccount(account)}
                    >
                      <Settings2 className="size-4" />
                    </Button>
                  )}
                  {(account.connectionProvider || "direct") === "direct" && (
                    <Button asChild variant="ghost" size="icon">
                      <Link href={`/app/accounts/${account.id}/voice`}>
                        <MessageCircle className="size-4" />
                      </Link>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      confirm(`Disconnect ${account.displayName}?`) &&
                      disconnect.mutate(account.id)
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <h2 className="mb-4 mt-10 font-display text-2xl font-semibold">
        Connect a direct social account
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {platforms.data?.map((item) => {
          const connected = accounts.data?.some(
            (a) =>
              a.platform === item.platform &&
              (a.connectionProvider || "direct") === "direct",
          );
          const ready = item.implemented && item.configured;
          return (
            <Card key={item.platform} className={!ready ? "opacity-65" : ""}>
              <CardContent className="pt-5">
                <div className="flex items-center justify-between">
                  <span
                    className={`grid size-11 place-items-center rounded-2xl bg-gradient-to-br ${platformStyle[item.platform]} font-bold text-white`}
                  >
                    {item.platform[0].toUpperCase()}
                  </span>
                  {connected ? (
                    <Badge variant="success">
                      <Check className="mr-1 size-3" />
                      Connected
                    </Badge>
                  ) : !item.implemented ? (
                    <Badge variant="secondary">Coming soon</Badge>
                  ) : !item.configured ? (
                    <Badge variant="warning">Setup required</Badge>
                  ) : null}
                </div>
                <h3 className="mt-5 font-display text-xl font-semibold">
                  {titleCase(item.platform)}
                </h3>
                <p className="mt-1 min-h-10 text-xs leading-5 text-muted-foreground">
                  {ready
                    ? capabilityCopy(item)
                    : item.implemented
                      ? "The deployment owner needs to add OAuth credentials."
                      : "This platform adapter is being prepared."}
                </p>
                <Button
                  className="mt-4 w-full"
                  variant="outline"
                  disabled={connected || !ready}
                  onClick={() => connect(item.platform)}
                >
                  <Link2 className="size-4" />
                  {connected ? "Connected" : "Connect"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <PublishingDefaultsDialog
        account={defaultsAccount}
        onClose={() => setDefaultsAccount(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["accounts"] });
          setDefaultsAccount(null);
        }}
      />
    </>
  );
}

type DefaultsValues = {
  board: string;
  privacyLevel: string;
  postType: string;
  whoCanReply: string;
  autoAddMusic: string;
  duet: boolean;
  stitch: boolean;
  comment: boolean;
  brandContent: boolean;
  brandOrganic: boolean;
  aiGenerated: boolean;
  carousel: boolean;
};

function PublishingDefaultsDialog({
  account,
  onClose,
  onSaved,
}: {
  account: SocialAccount | null;
  onClose(): void;
  onSaved(): void;
}) {
  const { workspace } = useWorkspace();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DefaultsValues>();

  useEffect(() => {
    const defaults = account?.publishingDefaults || {};
    reset({
      board: String(defaults.board || ""),
      privacyLevel: String(defaults.privacy_level || "PUBLIC_TO_EVERYONE"),
      postType: String(defaults.post_type || "post"),
      whoCanReply: String(defaults.who_can_reply_post || "everyone"),
      autoAddMusic: String(defaults.autoAddMusic || "no"),
      duet: Boolean(defaults.duet),
      stitch: Boolean(defaults.stitch),
      comment:
        defaults.comment === undefined ? true : Boolean(defaults.comment),
      brandContent: Boolean(defaults.brand_content_toggle),
      brandOrganic: Boolean(defaults.brand_organic_toggle),
      aiGenerated: Boolean(defaults.video_made_with_ai),
      carousel:
        defaults.post_as_images_carousel === undefined
          ? true
          : Boolean(defaults.post_as_images_carousel),
    });
  }, [account, reset]);

  const save = useMutation({
    mutationFn: (values: DefaultsValues) => {
      if (!account) return Promise.resolve(null);
      let publishingDefaults: Record<string, unknown> =
        account.publishingDefaults || {};
      if (account.platform === "pinterest")
        publishingDefaults = { board: values.board };
      if (account.platform === "instagram")
        publishingDefaults = {
          ...publishingDefaults,
          post_type: values.postType,
        };
      if (account.platform === "twitter")
        publishingDefaults = {
          ...publishingDefaults,
          who_can_reply_post: values.whoCanReply,
        };
      if (account.platform === "linkedin")
        publishingDefaults = {
          ...publishingDefaults,
          post_as_images_carousel: values.carousel,
        };
      if (account.platform === "tiktok")
        publishingDefaults = {
          ...publishingDefaults,
          privacy_level: values.privacyLevel,
          duet: values.duet,
          stitch: values.stitch,
          comment: values.comment,
          autoAddMusic: values.autoAddMusic,
          brand_content_toggle: values.brandContent,
          brand_organic_toggle: values.brandOrganic,
          video_made_with_ai: values.aiGenerated,
          content_posting_method: "DIRECT_POST",
        };
      return api<SocialAccount>(
        `/social-accounts/${account.id}/publishing-defaults`,
        { method: "PATCH", ...json({ publishingDefaults }) },
        workspace?.id,
      );
    },
    onSuccess: () => {
      toast.success("Publishing defaults updated");
      onSaved();
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not update defaults",
      ),
  });

  return (
    <Dialog open={!!account} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publishing defaults</DialogTitle>
          <DialogDescription>
            {account
              ? `Applied whenever ${account.displayName} publishes through ${titleCase(account.connectionProvider)}.`
              : "Channel publishing defaults."}
          </DialogDescription>
        </DialogHeader>
        {account && (
          <form
            className="space-y-5"
            onSubmit={handleSubmit((values) => save.mutate(values))}
          >
            {account.platform === "pinterest" && (
              <FormInput
                name="board"
                label="Pinterest board ID"
                required
                register={register}
                rules={{ required: "Enter the board ID" }}
                error={errors.board?.message}
              />
            )}
            {account.platform === "instagram" && (
              <FormSelect
                name="postType"
                label="Instagram post type"
                register={register}
                options={[
                  { value: "post", label: "Post" },
                  { value: "reel", label: "Reel" },
                  { value: "story", label: "Story" },
                ]}
              />
            )}
            {account.platform === "twitter" && (
              <FormSelect
                name="whoCanReply"
                label="Who can reply"
                register={register}
                options={[
                  { value: "everyone", label: "Everyone" },
                  { value: "following", label: "Accounts you follow" },
                  { value: "mentionedUsers", label: "Mentioned accounts" },
                ]}
              />
            )}
            {account.platform === "tiktok" && (
              <>
                <FormSelect
                  name="privacyLevel"
                  label="TikTok privacy"
                  register={register}
                  options={[
                    { value: "PUBLIC_TO_EVERYONE", label: "Public" },
                    { value: "FOLLOWER_OF_CREATOR", label: "Followers" },
                    { value: "MUTUAL_FOLLOW_FRIENDS", label: "Friends" },
                    { value: "SELF_ONLY", label: "Only me" },
                  ]}
                />
                <FormSelect
                  name="autoAddMusic"
                  label="Automatically add music"
                  register={register}
                  options={[
                    { value: "no", label: "No" },
                    { value: "yes", label: "Yes" },
                  ]}
                />
                <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
                  {[
                    ["duet", "Allow duets"],
                    ["stitch", "Allow stitches"],
                    ["comment", "Allow comments"],
                    ["brandContent", "Branded content"],
                    ["brandOrganic", "Brand organic"],
                    ["aiGenerated", "AI-generated media"],
                  ].map(([name, label]) => (
                    <label
                      key={name}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--primary)]"
                        {...register(name as keyof DefaultsValues)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </>
            )}
            {account.platform === "linkedin" && (
              <label className="flex items-center gap-2 rounded-xl border p-4 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--primary)]"
                  {...register("carousel")}
                />
                Publish multiple images as a carousel
              </label>
            )}
            {account.platform === "facebook" && (
              <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
                Facebook does not require additional account defaults.
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save defaults"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function capabilityCopy(item: PlatformAvailability) {
  const caps = [];
  if (item.capabilities?.supportsSlideshow) caps.push("slideshows");
  if (item.capabilities?.supportsVideo) caps.push("video");
  if (item.capabilities?.supportsPost) caps.push("posts");
  return `Publish ${caps.join(", ")} from this workspace.`;
}
