import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FileItem, FileTreeItem } from '@/types';

interface FileState {
  currentFile: FileItem | null;
  fileTree: FileTreeItem[];
  expandedFolders: Set<number>;
  setCurrentFile: (file: FileItem | null) => void;
  setFileTree: (tree: FileTreeItem[]) => void;
  toggleFolder: (folderId: number) => void;
  isFolderExpanded: (folderId: number) => boolean;
}

export const useFileStore = create<FileState>()(
  persist(
    (set, get) => ({
      currentFile: null,
      fileTree: [],
      expandedFolders: new Set<number>(),

      setCurrentFile: (file) => set({ currentFile: file }),

      setFileTree: (tree) => set({ fileTree: tree }),

      toggleFolder: (folderId) => {
        const expanded = new Set(get().expandedFolders);
        if (expanded.has(folderId)) {
          expanded.delete(folderId);
        } else {
          expanded.add(folderId);
        }
        set({ expandedFolders: expanded });
      },

      isFolderExpanded: (folderId) => get().expandedFolders.has(folderId),
    }),
    {
      name: 'file-tree-storage',
      partialize: (state) => ({
        expandedFolders: Array.from(state.expandedFolders),
      }),
      onRehydrateStorage: () => (state) => {
        const raw = state as unknown as { expandedFolders?: unknown } | undefined;
        if (raw && Array.isArray(raw.expandedFolders)) {
          (state as FileState).expandedFolders = new Set(
            raw.expandedFolders as number[],
          );
        }
      },
    },
  ),
);