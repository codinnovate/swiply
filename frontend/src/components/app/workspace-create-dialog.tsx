"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { FormInput } from "@/components/forms/form-fields";
import { Button } from "@/components/ui/button";
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
import type { Workspace } from "@/lib/types";

interface WorkspaceFormValues {
  name: string;
}

interface WorkspaceCreateDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  onCreated(workspace: Workspace): void;
}

export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function WorkspaceCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: WorkspaceCreateDialogProps) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WorkspaceFormValues>({ defaultValues: { name: "" } });

  const createWorkspace = useMutation({
    mutationFn: ({ name }: WorkspaceFormValues) =>
      api<Workspace>(
        "/workspaces",
        {
          method: "POST",
          ...json({ name: name.trim(), timezone: getBrowserTimezone() }),
        },
      ),
    onSuccess: (workspace) => {
      const ownedWorkspace: Workspace = {
        ...workspace,
        role: workspace.role ?? "owner",
      };

      queryClient.setQueryData<Workspace[]>(queryKeys.workspaces, (current = []) => [
        ...current.filter((item) => item.id !== ownedWorkspace.id),
        ownedWorkspace,
      ]);
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });

      reset();
      onCreated(ownedWorkspace);
      toast.success(`${ownedWorkspace.name} created`);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not create workspace"),
  });

  const submit = handleSubmit((values) => createWorkspace.mutate(values));

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && createWorkspace.isPending) return;
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a workspace</DialogTitle>
          <DialogDescription>
            Give this workspace a name. Scheduling will use your current timezone.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <FormInput
            name="name"
            label="Workspace name"
            placeholder="Acme Social"
            autoComplete="organization"
            autoFocus
            maxLength={80}
            disabled={createWorkspace.isPending}
            register={register}
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
            error={errors.name?.message}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={createWorkspace.isPending}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createWorkspace.isPending}>
              {createWorkspace.isPending && (
                <LoaderCircle className="size-4 animate-spin" />
              )}
              Create workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
