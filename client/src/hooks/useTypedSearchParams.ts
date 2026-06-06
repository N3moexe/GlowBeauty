import { useCallback, useMemo } from "react";
import { useLocation, useSearch } from "wouter";

export function useTypedSearchParams<T extends Record<string, string>>() {
  const rawSearch = useSearch();
  const [location, setLocation] = useLocation();

  const params = useMemo((): Partial<T> => {
    const p = new URLSearchParams(rawSearch);
    return Object.fromEntries(p.entries()) as Partial<T>;
  }, [rawSearch]);

  const setParam = useCallback(
    (key: keyof T & string, value: string | null) => {
      const p = new URLSearchParams(rawSearch);
      if (value == null) {
        p.delete(key);
      } else {
        p.set(key, value);
      }
      const qs = p.toString();
      const base = location.split("?")[0];
      setLocation(qs ? `${base}?${qs}` : base, { replace: true });
    },
    [location, rawSearch, setLocation]
  );

  return { params, setParam };
}
