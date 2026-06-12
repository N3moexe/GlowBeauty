# GlowBeauty 🌍🛍️

**Open-source e-commerce platform built for French-speaking West Africa** — with native mobile money payments (Wave, Orange Money, Free Money), XOF/CFA currency, and a French-language storefront.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-170%20passing-brightgreen)](server)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](tsconfig.json)

## Why GlowBeauty?

Platforms like Shopify and WooCommerce assume credit cards. In Senegal and across
French-speaking West Africa, **most consumers pay with mobile money** — Wave,
Orange Money, Free Money. GlowBeauty is a complete, self-hostable commerce stack
designed around that reality:

- 💳 **Mobile money first** — Wave, Orange Money, and Free Money payment
  integrations built in (plus optional card support)
- 🪙 **XOF/CFA currency** handling throughout cart, checkout, and orders
- 🇫🇷 **French-language UI** for storefront and admin
- 🚚 **Local shipping zones & rates** (Dakar + regions, configurable ETAs)
- 💬 WhatsApp-integrated customer chatbot

## Features

### Storefront
- Modern React storefront: product catalog, search, cart, one-click checkout,
  order tracking, reviews, coupons, product comparison
- Server-side SEO injection: per-product meta tags, Open Graph, JSON-LD
  structured data (Product, BreadcrumbList), canonical URLs, sitemap.xml,
  proper 404s for removed products

### Admin CMS (WordPress-style)
- Products, categories, inventory, orders, customers
- Homepage section builder with live preview
- Static pages, navigation menus, theme colors, media library
- Email templates, banners/promos, coupons
- Analytics, reports, audit logs
- Role-based staff access (admin / manager / editor), optional 2FA

### Engineering
- Full-stack TypeScript: React 18, Express, tRPC, Drizzle ORM, MySQL,
  Tailwind CSS, Vite
- 170+ automated tests, strict typecheck, security smoke tests
- Demo mode: runs with zero config (in-memory data) for instant local dev
- One-command production build; deploys to Railway/Render/any Node host

## Quick start

```bash
pnpm install
pnpm dev          # runs in demo mode at http://localhost:3000 — no DB needed
```

### Production

```bash
pnpm build
DATABASE_URL=mysql://... NODE_ENV=production pnpm start
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for a full step-by-step production guide
(Railway + MySQL + domain + payments).

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MySQL connection string (omit for demo mode) |
| `JWT_SECRET` | Session signing secret |
| `APP_URL` | Public site URL (canonical tags, sitemap, emails) |
| `WAVE_API_KEY` / `ORANGE_MONEY_API_KEY` / `FREE_MONEY_API_KEY` | Payment providers |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Transactional email |

## Scripts

```bash
pnpm dev           # dev server (demo mode without DATABASE_URL)
pnpm check         # TypeScript typecheck
pnpm test          # run the test suite
pnpm build         # production build (client + server)
pnpm db:push       # generate + run database migrations
pnpm setup:admin   # create the first admin account
```

## Contributing

Issues and pull requests are welcome. Please run `pnpm check && pnpm test`
before submitting.

## License

[MIT](LICENSE) © 2026 Ibrahima Dia Ndao
