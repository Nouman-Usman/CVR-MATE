import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface SearchFiltersState {
  query: string;
  industryText: string;
  industryCode: string;
  companyForm: string;
  size: string;
  zipcode: string;
  region: string;
  foundedPeriod: string;
  revenueMin: number;
  revenueMax: number;
  profitMin: number;
  profitMax: number;
  employeesMin: number;
  employeesMax: number;
}

interface SearchUIState extends SearchFiltersState {
  // UI state
  showFilters: boolean;
  page: number;
  scrollY: number;
  selected: string[];
  hasSearched: boolean;

  // Actions
  setFilter: <K extends keyof SearchFiltersState>(
    key: K,
    value: SearchFiltersState[K]
  ) => void;
  setPage: (page: number) => void;
  setScrollY: (y: number) => void;
  setHasSearched: (v: boolean) => void;
  setShowFilters: (v: boolean) => void;
  toggleSelect: (cvr: string) => void;
  selectAll: (cvrs: string[]) => void;
  clearSelected: () => void;
  resetAll: () => void;
}

const initialFilters: SearchFiltersState = {
  query: "",
  industryText: "",
  industryCode: "all",
  companyForm: "all",
  size: "all",
  zipcode: "",
  region: "all",
  foundedPeriod: "all",
  revenueMin: 0,
  revenueMax: 1000,
  profitMin: 0,
  profitMax: 1000,
  employeesMin: 0,
  employeesMax: 5000,
};

export const useSearchStore = create<SearchUIState>()(
  persist(
    (set) => ({
      ...initialFilters,
      showFilters: true,
      page: 1,
      scrollY: 0,
      selected: [],
      hasSearched: false,

      setFilter: (key, value) => set({ [key]: value }),
      setPage: (page) => set({ page }),
      setScrollY: (scrollY) => set({ scrollY }),
      setHasSearched: (hasSearched) => set({ hasSearched }),
      setShowFilters: (showFilters) => set({ showFilters }),

      toggleSelect: (cvr) =>
        set((state) => ({
          selected: state.selected.includes(cvr)
            ? state.selected.filter((c) => c !== cvr)
            : [...state.selected, cvr],
        })),

      selectAll: (cvrs) => set({ selected: cvrs }),
      clearSelected: () => set({ selected: [] }),

      resetAll: () =>
        set({
          ...initialFilters,
          showFilters: true,
          page: 1,
          scrollY: 0,
          selected: [],
          hasSearched: false,
        }),
    }),
    {
      name: "cvr-search-state",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? sessionStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            }
      ),
      // Only persist filters and UI position, not transient state
      partialize: (state) => ({
        query: state.query,
        industryText: state.industryText,
        industryCode: state.industryCode,
        companyForm: state.companyForm,
        size: state.size,
        zipcode: state.zipcode,
        region: state.region,
        foundedPeriod: state.foundedPeriod,
        revenueMin: state.revenueMin,
        revenueMax: state.revenueMax,
        profitMin: state.profitMin,
        profitMax: state.profitMax,
        employeesMin: state.employeesMin,
        employeesMax: state.employeesMax,
        showFilters: state.showFilters,
        page: state.page,
        scrollY: state.scrollY,
        hasSearched: state.hasSearched,
      }),
    }
  )
);
