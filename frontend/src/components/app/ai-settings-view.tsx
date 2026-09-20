"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, KeyRound, LoaderCircle, ShieldCheck, Trash2 } from "lucide-react";
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

export function AiSettingsView() {
  const queryClient = useQueryClient();
  const credentials = useQuery({ queryKey: queryKeys.credentials, queryFn: () => api<AiCredential[]>("/ai/credentials") });
  const models = useQuery({ queryKey: queryKeys.models, queryFn: () => api<AiModel[]>("/ai/models") });
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.credentials });
  return <div className="space-y-5"><div className="rounded-2xl border border-secondary/20 bg-secondary/5 p-5"><div className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-secondary" /><div><p className="text-sm font-semibold">Your keys stay personal</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Keys are validated by their provider, encrypted at rest, and never shown again. AI usage is billed directly by the provider you choose.</p></div></div></div><div className="grid gap-5 xl:grid-cols-3">{(["openai", "anthropic", "gemini"] as AiProvider[]).map((provider) => <ProviderCard key={provider} provider={provider} credential={credentials.data?.find((item) => item.provider === provider)} models={(models.data || []).filter((model) => model.provider === provider)} onSaved={refresh} />)}</div></div>;
}

function ProviderCard({ provider, credential, models, onSaved }: { provider: AiProvider; credential?: AiCredential; models: AiModel[]; onSaved(): void }) {
  const info = providerInfo[provider];
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ apiKey: string; defaultModel: string }>({ values: { apiKey: "", defaultModel: credential?.defaultModel || models[0]?.id || "" } });
  const save = useMutation({ mutationFn: (values: { apiKey: string; defaultModel: string }) => api(`/ai/credentials/${provider}`, { method: "PUT", ...json(values) }), onSuccess: () => { toast.success(`${info.name} connected`); reset(); onSaved(); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save key") });
  const remove = useMutation({ mutationFn: () => api(`/ai/credentials/${provider}`, { method: "DELETE" }), onSuccess: () => { toast.success(`${info.name} removed`); onSaved(); } });
  return <Card><CardHeader><div className="flex items-center justify-between"><span className="grid size-11 place-items-center rounded-2xl bg-foreground font-display text-lg font-bold text-background">{info.name[0]}</span>{credential ? <Badge variant="success"><Check className="mr-1 size-3" />Connected</Badge> : <Badge variant="secondary">Not connected</Badge>}</div><CardTitle className="pt-3">{info.name}</CardTitle><CardDescription>{info.description}</CardDescription></CardHeader><CardContent>{credential ? <div><div className="rounded-xl bg-muted p-3"><p className="text-xs text-muted-foreground">Saved key</p><p className="mt-1 font-mono text-sm">•••• •••• •••• {credential.keyHint}</p><p className="mt-2 text-xs text-muted-foreground">{credential.defaultModel} · Updated {formatDate(credential.updatedAt)}</p></div><Button variant="outline" className="mt-4 w-full" disabled={remove.isPending} onClick={() => confirm(`Remove your ${info.name} key?`) && remove.mutate()}><Trash2 className="size-4" />Remove key</Button></div> : <form className="space-y-4" onSubmit={handleSubmit((values) => save.mutate(values))}><FormInput name="apiKey" label="Secret API key" type="password" autoComplete="off" placeholder="Paste your key" register={register} required rules={{ required: "Enter your API key", minLength: { value: 20, message: "This key is too short" } }} error={errors.apiKey?.message} /><FormSelect name="defaultModel" label="Default model" register={register} options={models.map((model) => ({ value: model.id, label: model.name }))} /><Button className="w-full" disabled={save.isPending || models.length === 0}>{save.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />}Save and validate</Button></form>}</CardContent></Card>;
}
