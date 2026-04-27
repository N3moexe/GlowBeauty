import { Fragment, type ReactNode } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

export type PageHeaderBreadcrumb = {
  label: string;
  href?: string;
};

export const adminSpacingScale = {
  page: "space-y-6",
  section: "space-y-4",
  stack: "space-y-3",
  inline: "gap-3",
} as const;

export const adminTypographyScale = {
  pageTitle: "text-2xl font-semibold tracking-tight",
  sectionTitle: "text-base font-semibold tracking-tight",
  description: "text-sm text-muted-foreground",
  caption: "text-xs uppercase tracking-wide text-muted-foreground",
} as const;

export const adminCardClass = "rounded-xl border bg-card shadow-sm";
export const adminCardPadding = "p-4 md:p-5";

// Card usage rules:
// 1) Use one card per concern (metrics, table, alert block, form section).
// 2) Keep card padding from `adminCardPadding` for consistency.
// 3) Put a short title + optional description at the top of each card.
// 4) Use subtle borders and avoid nested heavy shadows.
export const adminCardUsageRules = [
  "One concern per card",
  "Consistent padding",
  "Short title and clear hierarchy",
  "Subtle borders over heavy decoration",
] as const;

type PageHeaderProps = {
  title: string;
  description?: string;
  breadcrumbs?: PageHeaderBreadcrumb[];
  actions?: ReactNode;
  className?: string;
};

export default function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 border-b border-border/70 pb-4 md:flex-row md:items-start md:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-1.5">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbs.map((crumb, index) => {
                const isLast = index === breadcrumbs.length - 1;
                return (
                  <Fragment key={`${crumb.label}-${index}`}>
                    <BreadcrumbItem>
                      {isLast || !crumb.href ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {!isLast && <BreadcrumbSeparator />}
                  </Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        )}
        <h1 className={adminTypographyScale.pageTitle}>{title}</h1>
        {description && (
          <p className={cn(adminTypographyScale.description, "max-w-3xl")}>
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

