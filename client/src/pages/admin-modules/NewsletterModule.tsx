import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";

const CARD =
  "rounded-2xl border border-[var(--admin-border,theme(colors.border/60))] bg-white/90 shadow-sm";
const CARD_PAD = "p-4 md:p-5";

export function NewsletterModule() {
  return (
    <section className="space-y-4">
      <div
        className={cn(
          CARD,
          CARD_PAD,
          "flex flex-col items-center justify-center py-16 text-center"
        )}
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--admin-accent-soft,#fdeee7)]">
          <Mail className="h-6 w-6 text-[var(--admin-accent,#e3744e)]" />
        </div>
        <h3 className="mb-2 text-base font-semibold">Newsletter subscribers</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          Subscriber export and campaign management are coming soon. The
          subscription list is stored in the database — add an admin procedure
          to the{" "}
          <code className="rounded bg-border/40 px-1 py-0.5 font-mono text-xs">
            emailSubscriptions
          </code>{" "}
          router to unlock this view.
        </p>
      </div>
    </section>
  );
}
