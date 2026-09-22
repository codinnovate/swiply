"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileVideo, LoaderCircle, Search, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { PinterestImportButton } from "@/components/app/pinterest-import-dialog";
import { EmptyState, ErrorState, PageLoader } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, json } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { MediaAsset } from "@/lib/types";
import { cn } from "@/lib/utils";

type Init = { id: string; partSize: number; partCount: number };
type Signed = { parts: { partNumber: number; url: string }[] };
type KindFilter = "" | "image" | "video";
type QueueItem = {
  id: string;
  file: File;
  status: "queued" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
};

const ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/quicktime,video/webm,.jpg,.jpeg,.png,.webp,.gif,.avif,.mp4,.mov,.webm";
const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const VIDEO_MIME = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

function resolveMedia(file: File) {
  let mime = file.type.toLowerCase();
  if (mime === "image/jpg") mime = "image/jpeg";
  if (!mime || mime === "application/octet-stream") {
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    mime = MIME_BY_EXT[extension] || "";
  }
  if (IMAGE_MIME.has(mime)) return { type: "image" as const, mimeType: mime };
  if (VIDEO_MIME.has(mime)) return { type: "video" as const, mimeType: mime };
  return null;
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function assetId(asset: MediaAsset) {
  return asset.id || asset._id || asset.url;
}

async function mapPool<T>(items: T[], limit: number, work: (item: T) => Promise<void>) {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await work(current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
}

export function MediaLibrary() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  const [type, setType] = useState<KindFilter>("");
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const uploading = queue.some((item) => item.status === "queued" || item.status === "uploading");
  const query = useQuery({
    queryKey: queryKeys.media(workspace?.id || "", type),
    queryFn: () => api<MediaAsset[]>(`/media${type ? `?type=${type}` : ""}`, {}, workspace?.id),
    enabled: !!workspace,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api<void>(`/media/${id}`, { method: "DELETE" }, workspace?.id),
    onSuccess: () => {
      toast.success("Media removed");
      qc.invalidateQueries({ queryKey: ["media"] });
    },
  });
  const assets = (query.data || []).filter((asset) =>
    (asset.fileName || asset.tags.join(" ")).toLowerCase().includes(search.toLowerCase()),
  );
  const overall =
    queue.length === 0
      ? 0
      : Math.round(queue.reduce((sum, item) => sum + item.progress, 0) / queue.length);

  function patchItem(id: string, patch: Partial<QueueItem>) {
    setQueue((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function uploadFile(file: File, id: string) {
    if (!workspace) return false;
    const media = resolveMedia(file);
    if (!media) {
      patchItem(id, { status: "error", progress: 0, error: "Unsupported file type" });
      return false;
    }
    patchItem(id, { status: "uploading", progress: 1 });
    let session: Init | undefined;
    try {
      session = await api<Init>(
        "/media/uploads",
        {
          method: "POST",
          ...json({
            fileName: file.name,
            mimeType: media.mimeType,
            sizeBytes: file.size,
            type: media.type,
          }),
        },
        workspace.id,
      );
      const nums = Array.from({ length: session.partCount }, (_, index) => index + 1);
      const signed = await api<Signed>(
        `/media/uploads/${session.id}/parts`,
        { method: "POST", ...json({ partNumbers: nums }) },
        workspace.id,
      );
      const completed: { partNumber: number; eTag?: string }[] = [];
      for (const part of signed.parts) {
        const start = (part.partNumber - 1) * session.partSize;
        const end = Math.min(start + session.partSize, file.size);
        const response = await fetch(part.url, { method: "PUT", body: file.slice(start, end) });
        if (!response.ok) throw new Error(`Part ${part.partNumber} failed`);
        const etag = response.headers.get("etag") || response.headers.get("ETag");
        completed.push({
          partNumber: part.partNumber,
          ...(etag ? { eTag: etag.replaceAll('"', "") } : {}),
        });
        patchItem(id, {
          progress: Math.round((completed.length / session.partCount) * 90),
        });
      }
      await api(
        `/media/uploads/${session.id}/complete`,
        { method: "POST", ...json({ parts: completed }) },
        workspace.id,
      );
      patchItem(id, { status: "done", progress: 100 });
      return true;
    } catch (error) {
      if (session) {
        await api(`/media/uploads/${session.id}`, { method: "DELETE" }, workspace.id).catch(
          () => undefined,
        );
      }
      patchItem(id, {
        status: "error",
        progress: 0,
        error: error instanceof Error ? error.message : "Upload failed",
      });
      return false;
    }
  }

  async function enqueue(files: FileList | File[]) {
    const incoming = Array.from(files);
    if (!incoming.length || !workspace) return;
    const items: QueueItem[] = incoming.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
      file,
      status: "queued",
      progress: 0,
    }));
    setQueue((current) => [...current, ...items]);
    setUploadOpen(true);
    const results = items.map((item) => ({ id: item.id, ok: false, file: item.file }));
    await mapPool(items, 3, async (item) => {
      const ok = await uploadFile(item.file, item.id);
      const entry = results.find((result) => result.id === item.id);
      if (entry) entry.ok = ok;
    });
    await qc.invalidateQueries({ queryKey: ["media"] });
    const succeeded = results.filter((result) => result.ok).length;
    if (succeeded === 1) toast.success(`${results.find((result) => result.ok)?.file.name} uploaded`);
    else if (succeeded > 1) toast.success(`${succeeded} files uploaded`);
    if (input.current) input.current.value = "";
  }

  return (
    <>
      <PageHeader
        eyebrow="Assets"
        title="Media library"
        description="Upload once, reuse everywhere. Images and videos are stored privately in S3 and delivered through CloudFront."
        actions={
          <div className="flex gap-2">
            <PinterestImportButton />
            <Button onClick={() => setUploadOpen(true)}>
              <UploadCloud className="size-4" />
              Upload media
            </Button>
          </div>
        }
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search files or tags"
          />
        </div>
        <div className="flex gap-2">
          {(
            [
              ["", "All"],
              ["image", "Images"],
              ["video", "Videos"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value || "all"}
              size="sm"
              variant={type === value ? "secondary" : "outline"}
              onClick={() => setType(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
      {query.isLoading ? (
        <PageLoader />
      ) : query.isError ? (
        <ErrorState message={(query.error as Error).message} retry={() => query.refetch()} />
      ) : assets.length === 0 ? (
        <EmptyState
          title="Your library is empty"
          description="Add product shots, brand graphics, photos, or finished videos."
          icon={UploadCloud}
          action={<Button onClick={() => setUploadOpen(true)}>Upload your first asset</Button>}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {assets.map((asset) => {
            const id = assetId(asset);
            return (
              <Card key={id} className="group overflow-hidden">
                <div className="relative aspect-square bg-muted">
                  {asset.type === "image" ? (
                    <img
                      src={asset.url}
                      alt={asset.fileName || "Media asset"}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="grid size-full place-items-center">
                      <FileVideo className="size-9 text-muted-foreground" />
                    </div>
                  )}
                  <button
                    onClick={() => confirm("Delete this media asset?") && remove.mutate(id)}
                    className="absolute right-2 top-2 grid size-8 place-items-center rounded-lg bg-card/90 text-muted-foreground opacity-0 shadow group-hover:opacity-100 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="p-3">
                  <p className="truncate text-xs font-semibold">{asset.fileName || asset.mimeType}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <Badge variant="secondary">{asset.type}</Badge>
                    <span className="text-[10px] text-muted-foreground">{formatBytes(asset.sizeBytes)}</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          if (!open && uploading) return;
          setUploadOpen(open);
          if (!open) setQueue([]);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload media</DialogTitle>
            <DialogDescription>
              Drop several images at once. Images up to 50 MB and videos up to 2 GB upload directly to S3.
            </DialogDescription>
          </DialogHeader>
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (event.dataTransfer.files.length) void enqueue(event.dataTransfer.files);
            }}
            className="grid min-h-44 place-items-center rounded-2xl border-2 border-dashed bg-muted/30 p-8 text-center hover:border-primary"
          >
            <div>
              {uploading ? (
                <>
                  <LoaderCircle className="mx-auto size-8 animate-spin text-primary" />
                  <p className="mt-3 text-sm font-semibold">Uploading… {overall}%</p>
                  <div className="mx-auto mt-3 h-2 w-52 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-all" style={{ width: `${overall}%` }} />
                  </div>
                </>
              ) : (
                <>
                  <UploadCloud className="mx-auto size-9 text-primary" />
                  <p className="mt-4 text-sm font-semibold">Drop files here or browse</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    JPEG, PNG, WebP, GIF, AVIF, MP4, MOV, or WebM
                  </p>
                </>
              )}
            </div>
          </button>
          {!!queue.length && (
            <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
              {queue.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2">
                  <span className="min-w-0 truncate font-medium">{item.file.name}</span>
                  <span
                    className={cn(
                      "shrink-0",
                      item.status === "error" && "text-destructive",
                      item.status === "done" && "text-emerald-600",
                    )}
                  >
                    {item.status === "done"
                      ? "Done"
                      : item.status === "error"
                        ? item.error || "Failed"
                        : `${item.progress}%`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <input
            ref={input}
            type="file"
            hidden
            multiple
            accept={ACCEPT}
            onChange={(event) => {
              if (event.target.files?.length) void enqueue(event.target.files);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
