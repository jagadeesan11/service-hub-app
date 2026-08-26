import { create } from 'zustand';

type AppState = {
  activeCategoryId: string | null;
  setActiveCategoryId: (id: string | null) => void;
};

export const useAppStore = create<AppState>((set) => ({
  activeCategoryId: null,
  setActiveCategoryId: (id) => set({ activeCategoryId: id }),
}));
