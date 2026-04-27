import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ThemeConfig } from "@shared/storefront-cms";
import {
  fetchStorefrontTheme,
  STOREFRONT_THEME_QUERY_KEY,
} from "@/lib/storefrontCms";

/**
 * Brand theme — reads the current theme tokens from the CMS and injects them
 * into the document as CSS custom properties. Components that use --brand-accent,
 * --brand-text, etc. in class lists (via utility classes) automatically pick up
 * admin-driven color changes without reloading.
 *
 * Non-blocking: render children immediately with built-in defaults while the
 * fetch resolves, so this never delays the storefront paint.
 */
type BrandThemeContextValue = {
  theme: ThemeConfig | null;
  isLoading: boolean;
};

const BrandThemeContext = createContext<BrandThemeContextValue | null>(null);

export function BrandThemeProvider({ children }: { children: ReactNode }) {
  const themeQuery = useQuery({
    queryKey: STOREFRONT_THEME_QUERY_KEY,
    queryFn: fetchStorefrontTheme,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const theme = themeQuery.data ?? null;

  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    if (theme.brandAccent) root.style.setProperty("--brand-accent", theme.brandAccent);
    if (theme.brandAccentHover)
      root.style.setProperty("--brand-accent-hover", theme.brandAccentHover);
    if (theme.brandInk) root.style.setProperty("--brand-text", theme.brandInk);
    if (theme.brandBg) root.style.setProperty("--brand-bg", theme.brandBg);
  }, [theme]);

  useEffect(() => {
    if (!theme?.faviconUrl) return;
    const existing = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (existing) {
      existing.href = theme.faviconUrl;
      return;
    }
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = theme.faviconUrl;
    document.head.appendChild(link);
  }, [theme?.faviconUrl]);

  const value = useMemo(
    () => ({ theme, isLoading: themeQuery.isLoading }),
    [theme, themeQuery.isLoading]
  );

  return (
    <BrandThemeContext.Provider value={value}>{children}</BrandThemeContext.Provider>
  );
}

export function useBrandTheme(): BrandThemeContextValue {
  const ctx = useContext(BrandThemeContext);
  return ctx ?? { theme: null, isLoading: false };
}
