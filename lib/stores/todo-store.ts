import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type TodoFilter = "all" | "active" | "completed";
export type TodoSortKey = "dueDate" | "priority" | "created";

interface TodoFormState {
  title: string;
  description: string;
  priority: string;
  dueDate: string;
  companyCvr: string;
  companyId: string | null;
  companyName: string;
}

interface TodoEditState {
  editingId: string | null;
  title: string;
  description: string;
  priority: string;
  dueDate: string;
  companyId: string | null;
  companyCvr: string;
  companyName: string;
}

interface CompanyPickerState {
  isOpen: boolean;
  search: string;
}

interface TodoUIState {
  // Filters & sorting
  filter: TodoFilter;
  sortKey: TodoSortKey;
  showSortMenu: boolean;

  // Form
  showForm: boolean;
  form: TodoFormState;

  // Edit
  edit: TodoEditState;

  // Company picker
  picker: CompanyPickerState;
  editPicker: CompanyPickerState;

  // Actions — filters
  setFilter: (f: TodoFilter) => void;
  setSortKey: (k: TodoSortKey) => void;
  setShowSortMenu: (v: boolean) => void;

  // Actions — form
  setShowForm: (v: boolean) => void;
  setFormField: <K extends keyof TodoFormState>(key: K, value: TodoFormState[K]) => void;
  setFormCompany: (companyId: string | null, cvr: string, name: string) => void;
  resetForm: () => void;

  // Actions — edit
  startEdit: (todo: {
    id: string;
    title: string;
    description: string | null;
    priority: string;
    dueDate: string | null;
    companyId: string | null;
    company: { vat: string; name: string } | null;
  }) => void;
  setEditField: <K extends keyof TodoEditState>(key: K, value: TodoEditState[K]) => void;
  setEditCompany: (companyId: string | null, cvr: string, name: string) => void;
  cancelEdit: () => void;

  // Actions — company picker
  setPicker: (partial: Partial<CompanyPickerState>) => void;
  setEditPicker: (partial: Partial<CompanyPickerState>) => void;
}

const initialForm: TodoFormState = {
  title: "",
  description: "",
  priority: "medium",
  dueDate: "",
  companyCvr: "",
  companyId: null,
  companyName: "",
};

const initialEdit: TodoEditState = {
  editingId: null,
  title: "",
  description: "",
  priority: "medium",
  dueDate: "",
  companyId: null,
  companyCvr: "",
  companyName: "",
};

const initialPicker: CompanyPickerState = {
  isOpen: false,
  search: "",
};

export const useTodoStore = create<TodoUIState>()(
  persist(
    (set) => ({
      filter: "all",
      sortKey: "created",
      showSortMenu: false,
      showForm: false,
      form: { ...initialForm },
      edit: { ...initialEdit },
      picker: { ...initialPicker },
      editPicker: { ...initialPicker },

      setFilter: (filter) => set({ filter }),
      setSortKey: (sortKey) => set({ sortKey, showSortMenu: false }),
      setShowSortMenu: (showSortMenu) => set({ showSortMenu }),

      setShowForm: (showForm) => set({ showForm }),
      setFormField: (key, value) =>
        set((s) => ({ form: { ...s.form, [key]: value } })),
      setFormCompany: (companyId, cvr, name) =>
        set((s) => ({
          form: { ...s.form, companyId, companyCvr: cvr, companyName: name },
          picker: { isOpen: false, search: "" },
        })),
      resetForm: () =>
        set({
          form: { ...initialForm },
          showForm: false,
          picker: { ...initialPicker },
        }),

      startEdit: (todo) =>
        set({
          edit: {
            editingId: todo.id,
            title: todo.title,
            description: todo.description || "",
            priority: todo.priority,
            dueDate: todo.dueDate || "",
            companyId: todo.companyId,
            companyCvr: todo.company?.vat || "",
            companyName: todo.company?.name || "",
          },
          editPicker: { ...initialPicker },
        }),
      setEditField: (key, value) =>
        set((s) => ({ edit: { ...s.edit, [key]: value } })),
      setEditCompany: (companyId, cvr, name) =>
        set((s) => ({
          edit: { ...s.edit, companyId, companyCvr: cvr, companyName: name },
          editPicker: { isOpen: false, search: "" },
        })),
      cancelEdit: () =>
        set({ edit: { ...initialEdit }, editPicker: { ...initialPicker } }),

      setPicker: (partial) =>
        set((s) => ({ picker: { ...s.picker, ...partial } })),
      setEditPicker: (partial) =>
        set((s) => ({ editPicker: { ...s.editPicker, ...partial } })),
    }),
    {
      name: "cvr-todo-ui",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? sessionStorage
          : { getItem: () => null, setItem: () => {}, removeItem: () => {} }
      ),
      partialize: (state) => ({
        filter: state.filter,
        sortKey: state.sortKey,
      }),
    }
  )
);
