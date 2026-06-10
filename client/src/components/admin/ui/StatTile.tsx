import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Surface } from "./Surface";

export type StatDelta = {
  /** Percentage change vs the comparison period (e.g. 12.4 for +12.4%). */
  pct: number;
  /** Short label describing the comparison, e.g. "vs début de période". */
  label?: string;
  /** When true, a downward movement is treated as good (e.g. refunds). */
  invert?: boolean;
};

type StatTileProps = {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  delta?: StatDelta | null;
  icon?: ReactNode;
  accent?: boolean;
  className?: string;
};

function DeltaBadge({ delta }: { delta: StatDelta }) {
  const rounded = Math.round(delta.pct * 10) / 10;
  const isFlat = Math.abs(rounded) < 0.1;
  const isUp = rounded > 0;
  // "Good" = up unless inverted. Flat is neutral.
  const isGood = isFlat ? null : delta.invert ? !isUp : isUp;

  const tone = isFlat
    ? "bg-[var(--admin-accent-soft)] text-[var(--admin-muted)]"
    : isGood
      ? "bg-emerald-50 text-emerald-600"
      : "bg-rose-50 text-rose-600";

  const Icon = isFlat ? Minus : isUp ? ArrowUpRight : ArrowDownRight;
  const sign = isUp ? "+" : "";

  return (
    <span className="mt-1.5 flex items-center gap-1.5 text-xs">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold",
          tone
        )}
      >
        <Icon className="h-3 w-3" />
        {isFlat ? "0%" : `${sign}${rounded}%`}
      </span>
      {delta.label ? (
        <span className="text-[var(--admin-muted)]">{delta.label}</span>
      ) : null}
    </span>
  );
}

export function StatTile({
  label,
  value,
  sub,
  delta,
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
          {delta ? <DeltaBadge delta={delta} /> : null}
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
