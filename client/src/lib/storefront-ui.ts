export const storefrontSpacing = {
  page: "space-y-14 md:space-y-20",
  section: "section-shell",
  sectionCompact: "section-shell-sm",
  sectionLarge: "section-shell-lg",
  content: "space-y-6 md:space-y-8",
  header: "space-y-3",
} as const;

export const storefrontTypography = {
  display: "display-title",
  heroSubtitle: "text-base text-white/85 md:text-lg lg:text-xl",
  h1: "headline-title",
  h2: "section-title",
  h3: "text-lg font-bold tracking-tight text-foreground",
  body: "section-description",
  bodyStrong: "text-sm font-medium text-foreground/90 md:text-base",
  overline: "section-kicker",
  caption: "text-xs text-muted-foreground",
} as const;

export const storefrontMotion = {
  duration: {
    fast: 0.18,
    base: 0.28,
    reveal: 0.45,
    signature: 0.62,
  },
  ease: {
    smooth: [0.22, 1, 0.36, 1] as const,
    reveal: "easeOut" as const,
    poured: [0.22, 1, 0.36, 1] as const,
    elastic: [0.34, 1.56, 0.64, 1] as const,
  },
  hover: {
    scale: 1.01,
    lift: -3,
  },
  section: {
    inViewMargin: "-80px 0px -80px 0px",
    yOffset: 14,
  },
  stagger: {
    headline: 0.045,
    cascade: 0.06,
  },
  magnetic: {
    range: 6,
    spring: { stiffness: 220, damping: 18, mass: 0.32 },
  },
} as const;

export const storefrontButtons = {
  primary: "premium",
  secondary: "soft",
  ghostBrand: "ghost-brand",
  ctaSize: "2xl",
} as const;

export const storefrontCards = {
  base: "surface-card",
  interactive:
    "surface-card-strong transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
  muted: "rounded-2xl border border-border/70 bg-muted/20 shadow-none",
  panel: "section-frame",
} as const;

export const storefrontBadges = {
  sale: "sale",
  fresh: "new",
  outOfStock: "outofstock",
  premium: "premium",
} as const;

export const storefrontSkeletons = {
  card: "surface-card overflow-hidden p-0",
  row: "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
  section: "space-y-3",
} as const;

export const storefrontA11y = {
  focusVisible:
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
} as const;
