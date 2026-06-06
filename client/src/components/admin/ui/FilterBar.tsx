import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type FilterBarProps = {
  children: ReactNode;
  className?: string;
};

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-b border-[var(--admin-divider)] bg-[var(--admin-bg)] px-4 py-2.5",
        className
      )}
    >
      {children}
    </div>
  );
}
