"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, json } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { SocialAccount } from "@/lib/types";

export interface PinterestBoard {
  id: string;
  name: string;
  pinCount: number;
  coverUrl: string | null;
}

export interface PinterestImportResult {
  boardId: string;
  boardName: string;
  considered: number;
  imported: number;
  skipped: number;
  failed: number;
  capped: boolean;
}

export function PinterestImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  const [accountId, setAccountId] = useState<string>("");

  const accounts = useQuery({
    queryKey: queryKeys.accounts(workspace?.id || ""),
    queryFn: () => api<SocialAccount[]>("/social-accounts", {}, workspace?.id),
    enabled: !!workspace && open,
  });

  const pinterestAccounts = (accounts.data || []).filter(
    (account) =>
      account.platform === "pinterest" &&
      (account.connectionProvider || "direct") === "direct" &&
      account.status === "active",
  );
  const selected = accountId || pinterestAccounts[0]?.id || "";

  const boards = useQuery({
    queryKey: ["pinterest-boards", workspace?.id, selected],
    queryFn: () =>
      api<PinterestBoard[]>(
        `/social-accounts/${selected}/pinterest/boards`,
        {},
        workspace?.id,
      ),
    enabled: !!workspace && open && !!selected,
  });

  const importBoard = useMutation({
    mutationFn: (boardId: string) =>
      api<PinterestImportResult>(
        `/social-accounts/${selected}/pinterest/import`,
        { method: "POST", ...json({ boardId }) },
        workspace?.id,
      ),
    onSuccess: (result) => {
      toast.success(
        `Imported ${result.imported} image${result.imported === 1 ? "" : "s"} from ${result.boardName}` +
          (result.skipped ? ` (${result.skipped} already in the library)` : "") +
          (result.failed ? ` · ${result.failed} failed` : "") +
          (result.capped ? " · stopped at 40 pins" : ""),
      );
      qc.invalidateQueries({ queryKey: ["media"] });
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Import failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import a Pinterest board</DialogTitle>
          <DialogDescription>
            Copies image pins you own into this workspace media library. Videos are skipped. Up to 40 images per import.
          </DialogDescription>
        </DialogHeader>
        {pinterestAccounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Connect a Pinterest account on the Accounts page first. You must be the board owner.
          </p>
        ) : (
          <div className="space-y-4">
            {pinterestAccounts.length > 1 && (
              <select
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                value={selected}
                onChange={(event) => setAccountId(event.target.value)}
              >
                {pinterestAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.displayName}
                  </option>
                ))}
              </select>
            )}
            {boards.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading boards…</p>
            ) : boards.isError ? (
              <p className="text-sm text-destructive">
                {(boards.error as Error).message}
              </p>
            ) : (boards.data || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">This account has no boards yet.</p>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {(boards.data || []).map((board) => (
                  <div
                    key={board.id}
                    className="flex items-center gap-3 rounded-xl border p-3"
                  >
                    {board.coverUrl ? (
                      <img
                        src={board.coverUrl}
                        alt=""
                        className="size-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="size-12 rounded-lg bg-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{board.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {board.pinCount} pin{board.pinCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      disabled={importBoard.isPending}
                      onClick={() => importBoard.mutate(board.id)}
                    >
                      Import
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function PinterestImportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Download className="size-4" />
        Import from Pinterest
      </Button>
      <PinterestImportDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
