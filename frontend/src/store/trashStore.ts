import { create } from 'zustand';
import { TrashSettings } from '@/types';

interface TrashState {
  isExpanded: boolean;
  settings: TrashSettings | null;
  setExpanded: (expanded: boolean) => void;
  toggleExpanded: () => void;
  setSettings: (settings: TrashSettings) => void;
}

export const useTrashStore = create<TrashState>((set, get) => ({
  isExpanded: true,
  settings: null,

  setExpanded: (expanded) => set({ isExpanded: expanded }),

  toggleExpanded: () => set({ isExpanded: !get().isExpanded }),

  setSettings: (settings) => set({ settings }),
}));
