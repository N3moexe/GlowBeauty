import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Navigation } from "@shared/storefront-cms";
import { defaultNavigation } from "@shared/storefront-cms";
import {
  fetchStorefrontNavigation,
  STOREFRONT_NAV_QUERY_KEY,
} from "@/lib/storefrontCms";

type NavContextValue = {
  nav: Navigation;
  isLoading: boolean;
};

const NavContext = createContext<NavContextValue | null>(null);

export function StorefrontNavProvider({ children }: { children: ReactNode }) {
  const navQuery = useQuery({
    queryKey: STOREFRONT_NAV_QUERY_KEY,
    queryFn: fetchStorefrontNavigation,
    staleTime: 30_000,
  });

  const value = useMemo<NavContextValue>(() => {
    return {
      nav: navQuery.data ?? defaultNavigation(),
      isLoading: navQuery.isLoading,
    };
  }, [navQuery.data, navQuery.isLoading]);

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useStorefrontNav(): NavContextValue {
  const ctx = useContext(NavContext);
  return ctx ?? { nav: defaultNavigation(), isLoading: false };
}
