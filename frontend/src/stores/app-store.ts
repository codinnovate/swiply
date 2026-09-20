import { createStore } from "zustand/vanilla";

export type ModalName = "command" | "invite" | "workspace" | "workspace-create" | "upload" | "media-picker" | "schedule" | null;
export interface AppState {
  sidebarOpen: boolean;
  activeWorkspaceId: string | null;
  modal: ModalName;
  setSidebarOpen(value: boolean): void;
  setActiveWorkspaceId(value: string | null): void;
  openModal(value: Exclude<ModalName, null>): void;
  closeModal(): void;
}

export const createAppStore = (initial?: Partial<AppState>) => createStore<AppState>()((set) => ({
  sidebarOpen: false,
  activeWorkspaceId: null,
  modal: null,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setActiveWorkspaceId: (activeWorkspaceId) => set({ activeWorkspaceId }),
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),
  ...initial,
}));
