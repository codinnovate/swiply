export const queryKeys = {
  me: ["me"] as const,
  workspaces: ["workspaces"] as const,
  members: (workspaceId: string) =>
    ["workspaces", workspaceId, "members"] as const,
  accounts: (workspaceId: string) => ["accounts", workspaceId] as const,
  platforms: (workspaceId: string) => ["platforms", workspaceId] as const,
  publishingProviders: (workspaceId: string) =>
    ["publishing-providers", workspaceId] as const,
  content: (workspaceId: string, filters = "") =>
    ["content", workspaceId, filters] as const,
  media: (workspaceId: string, filters = "") =>
    ["media", workspaceId, filters] as const,
  posts: (workspaceId: string, filters = "") =>
    ["posts", workspaceId, filters] as const,
  schedules: (workspaceId: string) => ["schedules", workspaceId] as const,
  competitors: (workspaceId: string) => ["competitors", workspaceId] as const,
  competitorSources: (workspaceId: string) =>
    ["competitors", workspaceId, "sources"] as const,
  analytics: (workspaceId: string, days: number) => ["analytics", workspaceId, days] as const,
  credentials: ["ai-credentials"] as const,
  models: ["ai-models"] as const,
};
