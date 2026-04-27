import { ShieldCheck } from "lucide-react";
import { useStorefrontSettings } from "@/hooks/useStorefrontSettings";
import { cn } from "@/lib/utils";

type PaymentBadgesRowProps = {
  className?: string;
  tone?: "light" | "dark";
  label?: string;
};

export default function PaymentBadgesRow({
  className,
  tone = "light",
  label = "Paiement sécurisé",
}: PaymentBadgesRowProps) {
  const { settings } = useStorefrontSettings();
  const methods = (
    settings.paymentMethodsText ||
    "Wave, Orange Money, Free Money, Visa, Mastercard"
  )
    .split(",")
    .map(entry => entry.trim())
    .filter(Boolean);

  if (methods.length === 0) return null;

  const containerTone =
    tone === "dark"
      ? "bg-[#3a2a27]/85 text-white/90 border-white/15"
      : "bg-white/80 text-[#3f3733] border-[#e3d7ce]/85";
  const iconTone = tone === "dark" ? "text-white/85" : "text-[#7a5a62]";
  const pillTone =
    tone === "dark"
      ? "bg-white/10 text-white/92 border-white/10"
      : "bg-white/95 text-[#2c2622] border-[#e3d7ce]";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-full border px-3 py-2 backdrop-blur-sm",
        containerTone,
        className
      )}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1.5 pl-1 pr-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
          iconTone
        )}
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {methods.map(method => (
          <span
            key={method}
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
              pillTone
            )}
          >
            {method}
          </span>
        ))}
      </div>
    </div>
  );
}
