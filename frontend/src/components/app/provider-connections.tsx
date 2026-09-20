"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  Server,
  Trash2,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useWorkspace } from "@/components/app/app-shell";
import { FormInput, FormSelect } from "@/components/forms/form-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, json } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type {
  PublishingChannel,
  PublishingConnection,
  PublishingDiscovery,
  PublishingProvider,
} from "@/lib/types";
import { titleCase } from "@/lib/utils";

type Values = { apiKey: string; baseUrl: string; organizationId: string };

export function ProviderConnections() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [active, setActive] = useState<PublishingProvider | null>(null);
  const connections = useQuery({
    queryKey: queryKeys.publishingProviders(workspace?.id || ""),
    queryFn: () =>
      api<PublishingConnection[]>("/publishing-providers", {}, workspace?.id),
    enabled: !!workspace,
  });
  const remove = useMutation({
    mutationFn: (provider: PublishingProvider) =>
      api(
        `/publishing-providers/${provider}`,
        { method: "DELETE" },
        workspace?.id,
      ),
    onSuccess: () => {
      toast.success("Publishing provider disconnected");
      queryClient.invalidateQueries({ queryKey: ["publishing-providers"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not disconnect",
      ),
  });
  const sync = useMutation({
    mutationFn: (provider: PublishingProvider) =>
      api(
        `/publishing-providers/${provider}/sync`,
        { method: "POST" },
        workspace?.id,
      ),
    onSuccess: () => {
      toast.success("Provider channels synchronized");
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not synchronize channels",
      ),
  });
  return (
    <>
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        {(["buffer", "postiz"] as const).map((provider) => {
          const connection = connections.data?.find(
            (item) => item.provider === provider,
          );
          return (
            <Card key={provider} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <span className="grid size-11 place-items-center rounded-2xl bg-foreground text-background">
                    <Server className="size-5" />
                  </span>
                  {connection ? (
                    <Badge variant="success">
                      <Check className="mr-1 size-3" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="secondary">BYOK</Badge>
                  )}
                </div>
                <CardTitle className="pt-2">
                  {provider === "buffer" ? "Buffer" : "Postiz"}
                </CardTitle>
                <CardDescription>
                  {provider === "buffer"
                    ? "Publish through channels already connected to your Buffer organization."
                    : "Publish through Postiz Cloud or your public self-hosted instance."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {connection && (
                  <div className="mb-4 rounded-xl bg-muted p-3 text-xs">
                    <p className="font-mono">•••• •••• {connection.keyHint}</p>
                    <p className="mt-1 text-muted-foreground">
                      {connection.organizationName ||
                        connection.baseUrl ||
                        "Connected"}
                    </p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    variant={connection ? "outline" : "default"}
                    onClick={() => setActive(provider)}
                  >
                    <KeyRound className="size-4" />
                    {connection ? "Rotate key / import" : "Connect"}
                  </Button>
                  {connection && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title={`Sync ${titleCase(provider)} channels`}
                      disabled={sync.isPending}
                      onClick={() => sync.mutate(provider)}
                    >
                      <RefreshCw
                        className={`size-4 ${sync.isPending && sync.variables === provider ? "animate-spin" : ""}`}
                      />
                    </Button>
                  )}
                  {connection && (
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={remove.isPending}
                      onClick={() =>
                        confirm(
                          `Disconnect ${titleCase(provider)}? Future posts must be canceled first.`,
                        ) && remove.mutate(provider)
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <ProviderDialog
        provider={active}
        connected={!!connections.data?.find((item) => item.provider === active)}
        onClose={() => setActive(null)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["publishing-providers"] });
          queryClient.invalidateQueries({ queryKey: ["accounts"] });
          setActive(null);
        }}
      />
    </>
  );
}

function ProviderDialog({
  provider,
  connected,
  onClose,
  onSaved,
}: {
  provider: PublishingProvider | null;
  connected: boolean;
  onClose(): void;
  onSaved(): void;
}) {
  const { workspace } = useWorkspace();
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    defaultValues: {
      apiKey: "",
      baseUrl: "https://api.postiz.com",
      organizationId: "",
    },
  });
  const [discovery, setDiscovery] = useState<PublishingDiscovery | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [boards, setBoards] = useState<Record<string, string>>({});
  const [privacy, setPrivacy] = useState<Record<string, string>>({});
  const discover = useMutation({
    mutationFn: (values: Values) =>
      api<PublishingDiscovery>(
        `/publishing-providers/${provider}/discover`,
        {
          method: "POST",
          ...json({
            apiKey: values.apiKey,
            baseUrl: provider === "postiz" ? values.baseUrl : undefined,
            organizationId: values.organizationId || undefined,
          }),
        },
        workspace?.id,
      ),
    onSuccess: (result) => {
      setDiscovery(result);
      if (result.channels.length)
        toast.success(
          `Found ${result.channels.length} supported channel${result.channels.length === 1 ? "" : "s"}. Choose channels, then save.`,
        );
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not validate key",
      ),
  });
  const save = useMutation({
    mutationFn: async (values: Values) => {
      await api(
        `/publishing-providers/${provider}`,
        {
          method: "PUT",
          ...json({
            apiKey: values.apiKey,
            baseUrl: provider === "postiz" ? values.baseUrl : undefined,
            organizationId: values.organizationId || undefined,
            organizationName: discovery?.organizations.find(
              (item) => item.id === values.organizationId,
            )?.name,
          }),
        },
        workspace?.id,
      );
      const channels = (discovery?.channels || [])
        .filter((item) => selected.includes(item.id))
        .map((item) => ({
          id: item.id,
          publishingDefaults: defaultsFor(
            item,
            boards[item.id],
            privacy[item.id],
          ),
        }));
      if (channels.length)
        await api(
          `/publishing-providers/${provider}/channels/import`,
          { method: "POST", ...json({ channels }) },
          workspace?.id,
        );
    },
    onSuccess: () => {
      toast.success("Provider and channels saved");
      onSaved();
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not save provider",
      ),
  });
  async function continueFlow(current: Values) {
    const result = await discover.mutateAsync(current);
    if (
      provider === "buffer" &&
      result.organizations.length &&
      !current.organizationId
    )
      setValue("organizationId", result.organizations[0].id);
  }
  return (
    <Dialog open={!!provider} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {connected ? "Manage" : "Connect"}{" "}
            {provider ? titleCase(provider) : "provider"}
          </DialogTitle>
          <DialogDescription>
            The key belongs to this workspace, is encrypted at rest, and is
            never shown again.
          </DialogDescription>
        </DialogHeader>
        {provider && (
          <form
            className="space-y-5"
            onSubmit={handleSubmit((form) =>
              discovery?.channels.length
                ? save.mutate(form)
                : continueFlow(form),
            )}
          >
            <FormInput
              name="apiKey"
              type="password"
              label={`${titleCase(provider)} API key`}
              placeholder="Paste your personal API key"
              autoComplete="off"
              register={register}
              required
              rules={{ required: "Enter your API key" }}
              error={errors.apiKey?.message}
            />
            {provider === "postiz" && (
              <FormInput
                name="baseUrl"
                type="url"
                label="Postiz origin"
                description="Cloud or a public HTTPS self-hosted origin; do not include /public/v1."
                register={register}
                required
              />
            )}
            {provider === "buffer" && discovery?.organizations.length ? (
              <FormSelect
                name="organizationId"
                label="Buffer organization"
                register={register}
                options={discovery.organizations.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
              />
            ) : null}
            {provider === "buffer" &&
            discovery &&
            discovery.organizations.length > 0 &&
            !discovery.channels.length ? (
              <Button
                type="button"
                className="w-full"
                onClick={() => continueFlow(getValues())}
                disabled={discover.isPending}
              >
                <RefreshCw className="size-4" />
                Load organization channels
              </Button>
            ) : null}
            {discovery?.channels.length ? (
              <div>
                <p className="mb-3 text-sm font-semibold">Choose channels</p>
                <div className="space-y-2">
                  {discovery.channels.map((channel) => (
                    <ChannelChoice
                      key={channel.id}
                      channel={channel}
                      checked={selected.includes(channel.id)}
                      onCheck={() =>
                        setSelected((current) =>
                          current.includes(channel.id)
                            ? current.filter((id) => id !== channel.id)
                            : [...current, channel.id],
                        )
                      }
                      board={boards[channel.id] || ""}
                      onBoard={(value) =>
                        setBoards((current) => ({
                          ...current,
                          [channel.id]: value,
                        }))
                      }
                      privacy={privacy[channel.id] || "PUBLIC_TO_EVERYONE"}
                      onPrivacy={(value) =>
                        setPrivacy((current) => ({
                          ...current,
                          [channel.id]: value,
                        }))
                      }
                    />
                  ))}
                </div>
              </div>
            ) : null}
            <Button
              className="w-full"
              disabled={
                discover.isPending ||
                save.isPending ||
                (!!discovery?.channels.length && !selected.length)
              }
            >
              {discover.isPending || save.isPending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <KeyRound className="size-4" />
              )}
              {discovery?.channels.length
                ? "Save provider and selected channels"
                : "Validate and discover"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ChannelChoice({
  channel,
  checked,
  onCheck,
  board,
  onBoard,
  privacy,
  onPrivacy,
}: {
  channel: PublishingChannel;
  checked: boolean;
  onCheck(): void;
  board: string;
  onBoard(value: string): void;
  privacy: string;
  onPrivacy(value: string): void;
}) {
  return (
    <div className="rounded-xl border p-3">
      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={checked}
          disabled={channel.disabled}
          onChange={onCheck}
          className="size-4 accent-[var(--primary)]"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {channel.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {titleCase(channel.platform)} · {channel.providerType}
          </span>
        </span>
        {channel.disabled && <Badge variant="warning">Unavailable</Badge>}
      </label>
      {checked && channel.platform === "pinterest" && (
        <input
          value={board}
          onChange={(event) => onBoard(event.target.value)}
          placeholder="Required Pinterest board ID"
          className="mt-3 h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        />
      )}
      {checked && channel.platform === "tiktok" && (
        <select
          value={privacy}
          onChange={(event) => onPrivacy(event.target.value)}
          className="mt-3 h-10 w-full rounded-xl border bg-background px-3 text-sm"
        >
          <option value="PUBLIC_TO_EVERYONE">Public</option>
          <option value="FOLLOWER_OF_CREATOR">Followers</option>
          <option value="MUTUAL_FOLLOW_FRIENDS">Friends</option>
          <option value="SELF_ONLY">Only me</option>
        </select>
      )}
    </div>
  );
}

function defaultsFor(
  channel: PublishingChannel,
  board?: string,
  privacy = "PUBLIC_TO_EVERYONE",
) {
  if (channel.platform === "pinterest") return { board };
  if (channel.platform === "tiktok")
    return {
      privacy_level: privacy,
      duet: false,
      stitch: false,
      comment: true,
      autoAddMusic: "no",
      brand_content_toggle: false,
      brand_organic_toggle: false,
      video_made_with_ai: false,
      content_posting_method: "DIRECT_POST",
    };
  if (channel.platform === "instagram")
    return { post_type: "post", is_trial_reel: false, collaborators: [] };
  if (channel.platform === "twitter")
    return {
      who_can_reply_post: "everyone",
      community: "",
      made_with_ai: false,
      paid_partnership: false,
    };
  if (channel.platform === "linkedin") return { post_as_images_carousel: true };
  return {};
}
