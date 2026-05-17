import { create } from "zustand";
import type { FileKind } from "@/types";

type KindFilter = "all" | FileKind;

interface UiState {
  isAdvancedOpen: boolean;
  activeKindFilter: KindFilter;
  setAdvancedOpen: (v: boolean) => void;
  setKindFilter: (v: KindFilter) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isAdvancedOpen: false,
  activeKindFilter: "all",
  setAdvancedOpen: (v) => set({ isAdvancedOpen: v }),
  setKindFilter: (v) => set({ activeKindFilter: v }),
}));

// Atomic selectors (HR-7)
export const useIsAdvancedOpen = () => useUiStore((s) => s.isAdvancedOpen);
export const useActiveKindFilter = () => useUiStore((s) => s.activeKindFilter);
