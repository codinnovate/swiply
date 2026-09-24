"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
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
import { api, json } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { AiCredential, AiModel, User, Workspace, WorkspaceMember } from "@/lib/types";
import { formatDate, initials, titleCase } from "@/lib/utils";
export function GeneralSettings() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api<User>("/auth/me"),
  });
  const profileForm = useForm<{ name: string; email: string }>({
    values: {
      name: me.data?.name || "",
      email: me.data?.email || "",
    },
  });
  const workspaceForm = useForm<{ name: string; timezone: string }>({
    values: {
      name: workspace?.name || "",
      timezone: workspace?.timezone || "UTC",
    },
  });
  const updateWorkspace = useMutation({
    mutationFn: (values: { name: string }) =>
      api<Workspace>(
        `/workspaces/${workspace?.id}`,
        { method: "PATCH", ...json({ name: values.name.trim() }) },
        workspace?.id,
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData<Workspace[]>(queryKeys.workspaces, (current = []) =>
        current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      toast.success("Workspace renamed");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not rename workspace"),
  });
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your personal details across Swiply.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <span className="grid size-16 place-items-center rounded-2xl bg-accent font-display text-xl font-bold">
              {initials(me.data?.name)}
            </span>
            <Button variant="outline" size="sm">
              Change photo
            </Button>
          </div>
          <FormInput
            name="name"
            label="Name"
            register={profileForm.register}
          />
          <FormInput
            name="email"
            label="Email"
            type="email"
            disabled
            register={profileForm.register}
          />
          <Button>Save profile</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>
            Names and dates follow these workspace defaults.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-5"
            onSubmit={workspaceForm.handleSubmit((values) =>
              updateWorkspace.mutate(values),
            )}
          >
            <FormInput
              name="name"
              label="Workspace name"
              maxLength={80}
              disabled={!workspace || updateWorkspace.isPending}
              register={workspaceForm.register}
              required
              rules={{
                required: "Enter a workspace name",
                maxLength: {
                  value: 80,
                  message: "Use 80 characters or fewer",
                },
                validate: (value) =>
                  value.trim().length > 0 || "Enter a workspace name",
              }}
              error={workspaceForm.formState.errors.name?.message}
            />
            <FormInput
              name="timezone"
              label="Timezone"
              readOnly
              register={workspaceForm.register}
            />
            <Button type="submit" disabled={!workspace || updateWorkspace.isPending}>
              {updateWorkspace.isPending && (
                <LoaderCircle className="size-4 animate-spin" />
              )}
              Save workspace
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
export function TeamSettings() {
  const { workspace } = useWorkspace();
  const members = useQuery({
    queryKey: queryKeys.members(workspace?.id || ""),
    queryFn: () =>
      api<WorkspaceMember[]>(`/workspaces/${workspace?.id}/members`),
    enabled: !!workspace,
  });
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>Workspace members</CardTitle>
          <CardDescription>
            Invite teammates and control what they can change.
          </CardDescription>
        </div>
        <Button>
          <UserPlus className="size-4" />
          Invite
        </Button>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {members.data?.map((member) => (
            <div key={member.id} className="flex items-center gap-3 py-4">
              <span className="grid size-10 place-items-center rounded-full bg-muted text-xs font-bold">
                {initials(member.user?.name || member.invitedEmail)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {member.user?.name || member.invitedEmail}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {member.user?.email || member.status}
                </p>
              </div>
              <Badge
                variant={member.status === "pending" ? "warning" : "secondary"}
              >
                {member.role}
              </Badge>
              <Button variant="ghost" size="icon">
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
type KeyValues = { apiKey: string; defaultModel: string };
export function AiSettings() {
  const qc = useQueryClient();
  const creds = useQuery({
    queryKey: queryKeys.credentials,
    queryFn: () => api<AiCredential[]>("/ai/credentials"),
  });
  const models = useQuery({
    queryKey: queryKeys.models,
    queryFn: () => api<AiModel[]>("/ai/models"),
  });
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-secondary/20 bg-secondary/5 p-5">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-secondary" />
          <div>
            <p className="text-sm font-semibold">Your keys stay personal</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Keys are validated on the server, encrypted at rest, and never
              shown again. AI usage is billed by your provider. Swiply does not
              use a shared AI key.
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <ProviderCard
          provider="openai"
          name="OpenAI"
          description="GPT models for copy, voice analysis, and images."
          credential={creds.data?.find((x) => x.provider === "openai")}
          models={models.data || []}
          onSaved={() =>
            qc.invalidateQueries({ queryKey: queryKeys.credentials })
          }
        />
        <ProviderCard
          provider="anthropic"
          name="Anthropic"
          description="Claude models for thoughtful, nuanced social copy."
          credential={creds.data?.find((x) => x.provider === "anthropic")}
          models={[]}
          unavailable
          onSaved={() => {}}
        />
        <ProviderCard
          provider="gemini"
          name="Google Gemini"
          description="Gemini models for copy and generated visual assets."
          credential={creds.data?.find((x) => x.provider === "gemini")}
          models={[]}
          unavailable
          onSaved={() => {}}
        />
      </div>
    </div>
  );
}
function ProviderCard({
  provider,
  name,
  description,
  credential,
  models,
  unavailable,
  onSaved,
}: {
  provider: string;
  name: string;
  description: string;
  credential?: AiCredential;
  models: AiModel[];
  unavailable?: boolean;
  onSaved(): void;
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<KeyValues>({
    defaultValues: {
      defaultModel: credential?.defaultModel || models.at(-1)?.id || "",
    },
  });
  const save = useMutation({
    mutationFn: (v: KeyValues) =>
      api(`/ai/credentials/${provider}`, { method: "PUT", ...json(v) }),
    onSuccess: () => {
      toast.success(`${name} connected`);
      reset({ apiKey: "", defaultModel: models.at(-1)?.id || "" });
      onSaved();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not save key"),
  });
  const remove = useMutation({
    mutationFn: () => api(`/ai/credentials/${provider}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Credential removed");
      onSaved();
    },
  });
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <span className="grid size-11 place-items-center rounded-2xl bg-foreground font-display text-lg font-bold text-background">
            {name[0]}
          </span>
          {credential ? (
            <Badge variant="success">
              <Check className="mr-1 size-3" />
              Connected
            </Badge>
          ) : unavailable ? (
            <Badge variant="warning">Backend pending</Badge>
          ) : (
            <Badge variant="secondary">Not connected</Badge>
          )}
        </div>
        <CardTitle className="pt-3">{name}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {credential ? (
          <div>
            <div className="rounded-xl bg-muted p-3">
              <p className="text-xs text-muted-foreground">Saved key</p>
              <p className="mt-1 font-mono text-sm">
                •••• •••• •••• {credential.keyHint}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {credential.defaultModel} · Updated{" "}
                {formatDate(credential.updatedAt)}
              </p>
            </div>
            <Button
              variant="outline"
              className="mt-4 w-full"
              onClick={() =>
                confirm("Remove this AI credential?") && remove.mutate()
              }
            >
              <Trash2 className="size-4" />
              Remove key
            </Button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={handleSubmit((v) => save.mutate(v))}
          >
            <FormInput
              name="apiKey"
              label="Secret API key"
              type="password"
              autoComplete="off"
              placeholder="Paste your key"
              register={register}
              required
              rules={{
                required: "Enter your API key",
                minLength: { value: 20, message: "This key is too short" },
              }}
              error={errors.apiKey?.message}
            />
            {models.length > 0 && (
              <FormSelect
                name="defaultModel"
                label="Default model"
                control={control}
                options={models.map((m) => ({ value: m.id, label: m.name }))}
              />
            )}
            <Button className="w-full" disabled={unavailable || save.isPending}>
              {save.isPending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <KeyRound className="size-4" />
              )}
              Save and validate
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
export function BillingSettings() {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader>
          <CardTitle>Plan and usage</CardTitle>
          <CardDescription>
            Your plan controls Swiply platform limits; AI charges go directly to
            your provider.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-2xl bg-muted p-5">
            <div>
              <Badge>Free</Badge>
              <p className="mt-3 font-display text-2xl font-semibold">
                Your current plan
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Upgrade when Stripe plans are configured.
              </p>
            </div>
            <CreditCard className="size-8 text-primary" />
          </div>
          {[
            ["Social accounts", 0, 2],
            ["Scheduled posts", 0, 20],
            ["Storage", 0, 100],
          ].map(([label, used, max]) => (
            <div key={String(label)} className="mt-5">
              <div className="flex justify-between text-xs">
                <span>{label}</span>
                <span>
                  {used} / {max}
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(Number(used) / Number(max)) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Need more room?</CardTitle>
          <CardDescription>
            Compare plans and unlock automation, engagement, and developer
            features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full">View upgrade options</Button>
          <Button className="mt-2 w-full" variant="ghost">
            Manage billing
            <ExternalLink className="size-3.5" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
export function NotificationSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          Choose what Swiply brings to your attention.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        {[
          [
            "Publishing failures",
            "Know when a platform rejects or delays a post.",
          ],
          [
            "Account health",
            "Get warned before an expired connection blocks publishing.",
          ],
          [
            "Automation review",
            "Receive a note when a reply needs human review.",
          ],
          [
            "Weekly digest",
            "A concise summary of content and publishing activity.",
          ],
        ].map(([name, desc], i) => (
          <label
            key={name}
            className="flex cursor-pointer items-center gap-4 py-4"
          >
            <div className="flex-1">
              <p className="text-sm font-semibold">{name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
            </div>
            <input
              type="checkbox"
              defaultChecked={i < 3}
              className="size-4 accent-[var(--primary)]"
            />
          </label>
        ))}
      </CardContent>
    </Card>
  );
}
