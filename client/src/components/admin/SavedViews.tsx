import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SavedView<TFilters = Record<string, unknown>> = {
  id: string;
  label: string;
  search?: string;
  filters?: Partial<TFilters>;
};

type SavedViewsProps<TFilters = Record<string, unknown>> = {
  storageKey: string;
  views: SavedView<TFilters>[];
  onApplyView: (view: SavedView<TFilters>) => void;
  className?: string;
};

export default function SavedViews<TFilters = Record<string, unknown>>({
  storageKey,
  views,
  onApplyView,
  className,
}: SavedViewsProps<TFilters>) {
  const [activeViewId, setActiveViewId] = useState<string>(views[0]?.id || "");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored && views.some(view => view.id === stored)) {
        setActiveViewId(stored);
      } else if (views[0]?.id) {
        setActiveViewId(views[0].id);
      }
    } catch {
      // localStorage may be unavailable in private contexts.
    } finally {
      setIsReady(true);
    }
  }, [storageKey, views]);

  useEffect(() => {
    if (!isReady) return;
    const activeView = views.find(view => view.id === activeViewId);
    if (!activeView) return;
    onApplyView(activeView);
  }, [activeViewId, isReady, onApplyView, views]);

  const handleSelect = (viewId: string) => {
    setActiveViewId(viewId);
    try {
      localStorage.setItem(storageKey, viewId);
    } catch {
      // Ignore persistence failures and keep UI usable.
    }
  };

  if (!views.length) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {views.map(view => (
        <Button
          key={view.id}
          type="button"
          size="sm"
          variant={activeViewId === view.id ? "default" : "outline"}
          className={activeViewId === view.id ? "bg-crimson hover:bg-crimson-light text-white" : ""}
          onClick={() => handleSelect(view.id)}
        >
          {view.label}
        </Button>
      ))}
    </div>
  );
}

