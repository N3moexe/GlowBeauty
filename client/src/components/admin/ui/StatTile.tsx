import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { Surface } from "./Surface";

type StatTileProps = {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  accent?: boolean;
  className?: string;
};

export function StatTile({
  label,
  value,
  sub,
  icon,
  accent,
  className,
}: StatTileProps) {
  return (
    <Surface accent={accent} className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
            {label}
          </p>
          <p className="mt-1 text-3xl font-semibold text-[var(--admin-ink)] [font-family:var(--font-admin-display)]">
            {value}
          </p>
          {sub ? (
            <p className="mt-1 text-xs text-[var(--admin-muted)]">{sub}</p>
          ) : null}
        </div>
        {icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]">
            {icon}
          </div>
        ) : null}
      </div>
    </Surface>
  );
}
