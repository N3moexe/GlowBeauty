import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusContext = "payment" | "stock" | "order" | "generic";
type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

type StatusBadgeProps = {
  status: string;
  context?: StatusContext;
  label?: string;
  className?: string;
};

const toneClasses: Record<StatusTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
};

function normalize(status: string) {
  return status.trim().toLowerCase().replace(/\s+/g, "_");
}

function mapStatus(status: string, context: StatusContext): { label: string; tone: StatusTone } {
  const normalized = normalize(status);

  if (context === "payment") {
    if (["paid", "completed"].includes(normalized)) return { label: "Paid", tone: "success" };
    if (["pending", "processing"].includes(normalized)) return { label: "Pending", tone: "warning" };
    if (["failed", "cancelled", "canceled"].includes(normalized)) return { label: "Cancelled", tone: "danger" };
  }

  if (context === "stock") {
    if (["in_stock", "in-stock", "active", "instock"].includes(normalized)) return { label: "In Stock", tone: "success" };
    if (["low_stock", "low-stock", "low"].includes(normalized)) return { label: "Low Stock", tone: "warning" };
    if (["out", "out_of_stock", "out-stock", "rupture"].includes(normalized)) return { label: "Out", tone: "danger" };
  }

  if (context === "order") {
    if (normalized === "pending") return { label: "Pending", tone: "warning" };
    if (["confirmed", "processing"].includes(normalized)) return { label: "Processing", tone: "info" };
    if (normalized === "shipped") return { label: "Shipped", tone: "info" };
    if (normalized === "delivered") return { label: "Delivered", tone: "success" };
    if (normalized === "cancelled") return { label: "Cancelled", tone: "danger" };
  }

  if (["active", "enabled", "published"].includes(normalized)) return { label: status, tone: "success" };
  if (["inactive", "disabled", "draft"].includes(normalized)) return { label: status, tone: "neutral" };

  return { label: status, tone: "neutral" };
}

export default function StatusBadge({
  status,
  context = "generic",
  label,
  className,
}: StatusBadgeProps) {
  const mapped = mapStatus(status, context);
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        toneClasses[mapped.tone],
        className
      )}
    >
      {label || mapped.label}
    </Badge>
  );
}

