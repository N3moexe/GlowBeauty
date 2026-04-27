import { Link } from "wouter";
import { useBrandTheme } from "@/contexts/BrandThemeContext";
import { ArrowRight } from "lucide-react";

/**
 * Top-of-page announcement strip. Reads its state from the admin-driven theme
 * config (/admin/theme). Renders nothing when the admin has it disabled or the
 * message is blank.
 */
export default function AnnouncementBar() {
  const { theme } = useBrandTheme();
  if (!theme?.announcementEnabled) return null;
  const text = theme.announcementText.trim();
  if (!text) return null;

  const href = theme.announcementHref.trim();
  const inner = (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-text md:text-sm">
      {text}
      {href ? <ArrowRight className="h-3.5 w-3.5" /> : null}
    </span>
  );

  return (
    <div className="relative border-b border-brand-border/50 bg-[linear-gradient(90deg,#fbe9db_0%,#f5d5be_50%,#eec3a6_100%)] text-brand-text">
      <div className="container flex min-h-10 items-center justify-center py-1.5 text-center">
        {href ? (
          /^https?:\/\//.test(href) ? (
            <a href={href} target="_blank" rel="noreferrer" className="transition-opacity hover:opacity-80">
              {inner}
            </a>
          ) : (
            <Link href={href} className="transition-opacity hover:opacity-80">
              {inner}
            </Link>
          )
        ) : (
          inner
        )}
      </div>
    </div>
  );
}
