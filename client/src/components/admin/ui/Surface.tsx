import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type SurfaceProps = {
  children: ReactNode;
  className?: string;
  accent?: boolean;
};

export function Surface({ children, className, accent = false }: SurfaceProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-admin-card)] border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[var(--admin-shadow)]",
        accent && "border-t-2 border-t-[var(--admin-accent)]",
        className
      )}
    >
      {children}
    </div>
  );
}
