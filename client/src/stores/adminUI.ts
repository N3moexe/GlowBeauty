import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AdminUIState = {
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  toggleSidebar: () => void;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
};

const AdminUIContext = createContext<AdminUIState | null>(null);

export function AdminUIProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("sbp_admin_sidebar_collapsed") === "1";
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(
      "sbp_admin_sidebar_collapsed",
      sidebarCollapsed ? "1" : "0"
    );
  }, [sidebarCollapsed]);

  const toggleSidebar = useCallback(() => setSidebarCollapsed(v => !v), []);
  const openMobileSidebar = useCallback(() => setMobileSidebarOpen(true), []);
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);

  const value = useMemo(
    () => ({
      sidebarCollapsed,
      mobileSidebarOpen,
      toggleSidebar,
      openMobileSidebar,
      closeMobileSidebar,
    }),
    [
      sidebarCollapsed,
      mobileSidebarOpen,
      toggleSidebar,
      openMobileSidebar,
      closeMobileSidebar,
    ]
  );

  return createElement(AdminUIContext.Provider, { value }, children);
}

export function useAdminUI(): AdminUIState {
  const ctx = useContext(AdminUIContext);
  if (!ctx) throw new Error("useAdminUI must be used within AdminUIProvider");
  return ctx;
}
