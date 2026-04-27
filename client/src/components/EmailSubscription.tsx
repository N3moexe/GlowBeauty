import { useMemo, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Mail, Loader2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { subscribeNewsletter } from "@/lib/newsletterApi";

function DrawnCheck({ className = "h-4 w-4" }: { className?: string }) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <motion.path
        d="M5 12.5l4.5 4.5L19 7"
        initial={
          shouldReduceMotion
            ? { pathLength: 1, opacity: 1 }
            : { pathLength: 0, opacity: 0 }
        }
        animate={{ pathLength: 1, opacity: 1 }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : {
                pathLength: { duration: 0.46, ease: [0.22, 1, 0.36, 1] },
                opacity: { duration: 0.18, ease: "easeOut" },
              }
        }
      />
    </motion.svg>
  );
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function inferLocaleFallback() {
  if (typeof navigator === "undefined") return "fr";
  const language = String(navigator.language || "")
    .trim()
    .toLowerCase();
  if (!language) return "fr";
  return language.split("-")[0] || "fr";
}

interface EmailSubscriptionProps {
  variant?: "inline" | "card";
  title?: string;
  description?: string;
  source?: string;
  locale?: string;
}

export default function EmailSubscription({
  variant = "inline",
  title = "Restez informe",
  description = "Recevez nos meilleures offres et actualites",
  source = "homepage",
  locale,
}: EmailSubscriptionProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "success" | "pending" | "already" | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const isEmailValid =
    normalizedEmail.length > 0 && EMAIL_REGEX.test(normalizedEmail);
  const canSubmit = isEmailValid && !isLoading;

  const handleSubscribe = async () => {
    if (!isEmailValid) {
      setStatus("error");
      setStatusMessage("Veuillez entrer une adresse email valide.");
      return;
    }

    setIsLoading(true);
    setStatus("idle");
    setStatusMessage("");
    try {
      const response = await subscribeNewsletter({
        email: normalizedEmail,
        source,
        locale: locale || inferLocaleFallback(),
      });
      if (response.already) {
        setStatus("already");
        setStatusMessage("Vous etes deja inscrit(e) a la newsletter.");
      } else if (response.pending) {
        setStatus("pending");
        setStatusMessage(
          "Vérifiez votre boîte mail — cliquez sur le lien de confirmation pour finaliser votre inscription."
        );
      } else {
        setStatus("success");
        setStatusMessage("Inscription reussie. Merci !");
      }
      setEmail("");
    } catch (error) {
      setStatus("error");
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Impossible de traiter votre inscription."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && canSubmit) {
      event.preventDefault();
      void handleSubscribe();
    }
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
    if (status !== "idle") {
      setStatus("idle");
      setStatusMessage("");
    }
  };

  const statusClass =
    status === "error"
      ? "text-rose-700"
      : status === "success" || status === "already" || status === "pending"
        ? "text-emerald-700"
        : "text-muted-foreground";

  if (variant === "card") {
    return (
      <Card variant="premium" className="rounded-2xl border-crimson/20 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-crimson/20">
            <Mail className="h-6 w-6 text-crimson" />
          </div>
          <div className="flex-1">
            <h3 className="mb-1 font-semibold">{title}</h3>
            <p className="mb-4 text-sm text-muted-foreground">{description}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={onInputChange}
                onKeyDown={onInputKeyDown}
                disabled={isLoading}
                className="text-sm"
              />
              <Button
                onClick={handleSubscribe}
                disabled={!canSubmit}
                variant="premium"
                className="px-4"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : status === "success" ||
                  status === "already" ||
                  status === "pending" ? (
                  <DrawnCheck />
                ) : (
                  "S'abonner"
                )}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              En vous inscrivant, vous acceptez de recevoir nos offres.
              Désinscription a tout moment.
            </p>
            {statusMessage ? (
              <p
                className={`mt-1 text-xs ${statusClass}`}
                role="status"
                aria-live="polite"
              >
                {statusMessage}
              </p>
            ) : null}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor="newsletter-inline-email" className="sr-only">
        Votre email
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="newsletter-inline-email"
          type="email"
          placeholder="Votre email..."
          value={email}
          onChange={onInputChange}
          onKeyDown={onInputKeyDown}
          disabled={isLoading}
          className="h-11 flex-1 rounded-xl border-white/20 bg-white text-slate-900"
        />
        <Button
          onClick={handleSubscribe}
          disabled={!canSubmit}
          variant="premium"
          className="h-11 rounded-xl px-6"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : status === "success" ||
            status === "already" ||
            status === "pending" ? (
            <DrawnCheck />
          ) : (
            <>
              <Mail className="h-4 w-4" />
              S'abonner
            </>
          )}
        </Button>
      </div>
      <p className="text-xs text-slate-700/85">
        En vous inscrivant, vous acceptez de recevoir nos offres. Désinscription
        a tout moment.
      </p>
      {statusMessage ? (
        <p
          className={`text-xs ${statusClass}`}
          role="status"
          aria-live="polite"
        >
          {statusMessage}
        </p>
      ) : null}
    </div>
  );
}
