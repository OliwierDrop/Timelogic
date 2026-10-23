import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type DependencyList,
  type ReactNode,
} from "react";

type FilterSidebarContextValue = {
  content: ReactNode;
  setContent: (node: ReactNode) => void;
};

const FilterSidebarContext = createContext<FilterSidebarContextValue | null>(
  null,
);

export function FilterSidebarProvider({ children }: { children: ReactNode }) {
  const [content, setContentState] = useState<ReactNode>(null);
  const setContent = useCallback((node: ReactNode) => {
    setContentState(node);
  }, []);
  const value = useMemo(
    () => ({ content, setContent }),
    [content, setContent],
  );
  return (
    <FilterSidebarContext.Provider value={value}>
      {children}
    </FilterSidebarContext.Provider>
  );
}

export function useFilterSidebarContent() {
  const ctx = useContext(FilterSidebarContext);
  if (!ctx) {
    throw new Error("useFilterSidebarContent outside FilterSidebarProvider");
  }
  return ctx.content;
}

/** Registers filter UI into the shared AppShell sidebar for this page. */
export function useSetFilterSidebar(
  factory: () => ReactNode,
  deps: DependencyList,
) {
  const ctx = useContext(FilterSidebarContext);
  if (!ctx) {
    throw new Error("useSetFilterSidebar outside FilterSidebarProvider");
  }
  const { setContent } = ctx;
  useEffect(() => {
    setContent(factory());
    return () => setContent(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
