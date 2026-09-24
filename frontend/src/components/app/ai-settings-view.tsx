"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, KeyRound, LoaderCircle, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormInput, FormSelect } from "@/components/forms/form-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, json } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { AiCredential, AiModel, AiProvider } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const providerInfo: Record<AiProvider, { name: string; description: string }> = {
  openai: { name: "OpenAI", description: "GPT models for copy, analysis, and creative work." },
  anthropic: { name: "Anthropic", description: "Claude models for nuanced, thoughtful social copy." },
  gemini: { name: "Google Gemini", description: "Gemini models for copy and generated visuals." },
};

const TASK_PROVIDER_ORDER: AiProvider[] = ["openai", "anthropic", "gemini"];

function taskChoice(credential: AiCredential) {
  return `${credential.provider}:${credential.defaultModel}`;
}

function currentTaskChoice(credentials: AiCredential[]) {
  const preferred = credentials.find((item) => item.preferred);
  if (preferred) return taskChoice(preferred);
  for (const provider of TASK_PROVIDER_ORDER) {
    const match = credentials.find((item) => item.provider === provider);
    if (match) return taskChoice(match);
  }
  return "";
}

export function AiSettingsView() {
  const queryClient = useQueryClient();
  const credentials = useQuery({
    queryKey: queryKeys.credentials,
    queryFn: () => api<AiCredential[]>("/ai/credentials"),
  });
  const models = useQuery({
    queryKey: queryKeys.models,
    queryFn: () => api<AiModel[]>("/ai/models"),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.credentials });
  const saved = credentials.data || [];
  const catalog = models.data || [];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-secondary/20 bg-secondary/5 p-5">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-secondary" />
          <div>
            <p className="text-sm font-semibold">Your keys stay personal</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Keys are validated by their provider, encrypted at rest, and never shown again. AI usage is billed
              directly by the provider you choose for tasks.
            </p>
          </div>
        </div>
      </div>
      <TaskModelCard credentials={saved} models={catalog} onSaved={refresh} />
      <div className="grid gap-5 xl:grid-cols-3">
        {TASK_PROVIDER_ORDER.map((provider) => (
          <ProviderCard
            key={provider}
            provider={provider}
            credential={saved.find((item) => item.provider === provider)}
            models={catalog.filter((model) => model.provider === provider)}
            onSaved={refresh}
          />
        ))}
      </div>
    </div>
  );
}

function TaskModelCard({
  credentials,
  models,
  onSaved,
}: {
  credentials: AiCredential[];
  models: AiModel[];
  onSaved(): void;
}) {
  const options = credentials.flatMap((credential) =>
    models
      .filter((model) => model.provider === credential.provider)
      .map((model) => ({
        value: `${credential.provider}:${model.id}`,
        label: `${providerInfo[credential.provider].name} · ${model.name}`,
      })),
  );
  const { control, handleSubmit, reset } = useForm<{ choice: string }>({
    defaultValues: { choice: currentTaskChoice(credentials) },
  });
  useEffect(() => {
    reset({ choice: currentTaskChoice(credentials) });
  }, [credentials, reset]);
  const save = useMutation({
    mutationFn: (choice: string) => {
      const [provider, ...rest] = choice.split(":");
      return api("/ai/preferences", {
        method: "PUT",
        ...json({ provider, model: rest.join(":") }),
      });
    },
    onSuccess: () => {
      toast.success("Default task model updated");
      onSaved();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save default model"),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </span>
          <Badge variant={credentials.length ? "success" : "secondary"}>
            {credentials.length ? "Used for research, copy, and automation" : "Connect a provider first"}
          </Badge>
        </div>
        <CardTitle className="pt-3">Default model for tasks</CardTitle>
        <CardDescription>
          Brand research, slideshow copy, and other AI jobs use this model. Connect OpenAI, Anthropic, or Gemini
          below, then pick one here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={handleSubmit((values) => save.mutate(values.choice))}>
          <FormSelect
            name="choice"
            label="Model"
            className="flex-1"
            control={control}
            required
            options={
              options.length
                ? options
                : [{ value: "", label: "Connect a provider to choose a model" }]
            }
          />
          <Button className="sm:mb-0.5" disabled={save.isPending || !options.length}>
            {save.isPending && <LoaderCircle className="size-4 animate-spin" />}
            Use for tasks
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ProviderCard({
  provider,
  credential,
  models,
  onSaved,
}: {
  provider: AiProvider;
  credential?: AiCredential;
  models: AiModel[];
  onSaved(): void;
}) {
  const info = providerInfo[provider];
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{ apiKey: string; defaultModel: string }>({
    values: { apiKey: "", defaultModel: credential?.defaultModel || models[0]?.id || "" },
  });
  const save = useMutation({
    mutationFn: (values: { apiKey: string; defaultModel: string }) =>
      api(`/ai/credentials/${provider}`, { method: "PUT", ...json(values) }),
    onSuccess: () => {
      toast.success(`${info.name} connected`);
      reset();
      onSaved();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save key"),
  });
  const remove = useMutation({
    mutationFn: () => api(`/ai/credentials/${provider}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(`${info.name} removed`);
      onSaved();
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <span className="grid size-11 place-items-center rounded-2xl bg-foreground font-display text-lg font-bold text-background">
            {info.name[0]}
          </span>
          {credential ? (
            <Badge variant="success">
              <Check className="mr-1 size-3" />
              {credential.preferred ? "Used for tasks" : "Connected"}
            </Badge>
          ) : (
            <Badge variant="secondary">Not connected</Badge>
          )}
        </div>
        <CardTitle className="pt-3">{info.name}</CardTitle>
        <CardDescription>{info.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {credential ? (
          <div>
            <div className="rounded-xl bg-muted p-3">
              <p className="text-xs text-muted-foreground">Saved key</p>
              <p className="mt-1 font-mono text-sm">•••• •••• •••• {credential.keyHint}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {credential.defaultModel} · Updated {formatDate(credential.updatedAt)}
              </p>
            </div>
            <Button
              variant="outline"
              className="mt-4 w-full"
              disabled={remove.isPending}
              onClick={() => confirm(`Remove your ${info.name} key?`) && remove.mutate()}
            >
              <Trash2 className="size-4" />
              Remove key
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit((values) => save.mutate(values))}>
            <FormInput
              name="apiKey"
              label="Secret API key"
              type="password"
              autoComplete="off"
              placeholder="Paste your key"
              register={register}
              required
              rules={{ required: "Enter your API key", minLength: { value: 20, message: "This key is too short" } }}
              error={errors.apiKey?.message}
            />
            <FormSelect
              name="defaultModel"
              label="Default model"
              control={control}
              options={models.map((model) => ({ value: model.id, label: model.name }))}
            />
            <Button className="w-full" disabled={save.isPending || models.length === 0}>
              {save.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              Save and validate
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
