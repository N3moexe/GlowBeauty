import { Link } from "wouter";
import { useStorefrontNav } from "@/contexts/StorefrontNavContext";

type EditorialFooterProps = {
  storeName: string;
  storeContact: string;
  supportEmail: string;
  footerAddress: string;
  paymentMethodsText?: string | null;
};

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  // External URLs get a standard anchor; internal routes use wouter.
  if (/^https?:\/\//.test(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="footer-link-underline w-fit transition-colors hover:text-brand-accent"
      >
        {children}
      </a>
    );
  }
  return (
    <Link
      href={href}
      className="footer-link-underline w-fit transition-colors hover:text-brand-accent"
    >
      {children}
    </Link>
  );
}

function toTelHref(value: string) {
  const normalized = value.replace(/[^\d+]/g, "");
  return normalized ? `tel:${normalized}` : "tel:+221788911010";
}

export default function EditorialFooter({
  storeName,
  storeContact,
  supportEmail,
  footerAddress,
  paymentMethodsText,
}: EditorialFooterProps) {
  const paymentBadges = (
    paymentMethodsText || "Wave, Orange Money, Free Money, Visa, Mastercard"
  )
    .split(",")
    .map(entry => entry.trim())
    .filter(Boolean);

  const { nav } = useStorefrontNav();

  return (
    <footer className="mt-auto border-t border-brand-border/75 bg-[linear-gradient(180deg,#f8ede5_0%,#f5e7dd_100%)]">
      <div className="container section-shell">
        <div
          className="grid gap-8 md:grid-cols-2 lg:grid-cols-[1.2fr_repeat(var(--footer-cols,3),minmax(0,1fr))]"
          style={{
            ["--footer-cols" as any]: Math.max(1, nav.footer.length + 1),
          }}
        >
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-accent-2">
              Maison
            </p>
            <h3 className="type-h2 text-[1.5rem] text-brand-text">
              {storeName}
            </h3>
            <p className="type-body text-brand-muted">
              Skincare premium, rituels éditoriaux et livraison rapide au
              Sénégal.
            </p>
          </div>

          {nav.footer.length > 0 ? (
            nav.footer.map(group => (
              <div key={group.id}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent-2">
                  {group.title || "Navigation"}
                </p>
                <div className="mt-3 space-y-2 text-sm text-brand-muted">
                  {group.items.map(item => (
                    <FooterLink key={item.id} href={item.href}>
                      {item.label}
                    </FooterLink>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent-2">
                Navigation
              </p>
              <div className="mt-3 space-y-2 text-sm text-brand-muted">
                <FooterLink href="/">Accueil</FooterLink>
                <FooterLink href="/boutique">Boutique</FooterLink>
                <FooterLink href="/suivi">Suivi commande</FooterLink>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent-2">
              Contact
            </p>
            <div className="mt-3 space-y-2 text-sm text-brand-muted">
              <a
                href={toTelHref(storeContact)}
                className="footer-link-underline w-fit transition-colors hover:text-brand-accent"
              >
                {storeContact}
              </a>
              <p>{supportEmail}</p>
              <p>{footerAddress}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-2 border-t border-brand-border/70 pt-5">
          {paymentBadges.map(method => (
            <span
              key={method}
              className="rounded-full border border-brand-border/75 bg-white/70 px-3 py-1 text-[11px] font-semibold text-brand-muted"
            >
              {method}
            </span>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2 border-t border-brand-border/65 pt-4 text-xs text-brand-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {storeName}. Tous droits reserves.
          </p>
          <p>Paiement securise en CFA, expedition Dakar et regions.</p>
        </div>
      </div>
    </footer>
  );
}
