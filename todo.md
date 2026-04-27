# SenBonsPlans - Project TODO

## Phase 1: Infrastructure & Setup
- [ ] Copy source files from original project to Manus project
- [ ] Install additional dependencies (sharp, nodemailer, react-easy-crop, etc.)
- [ ] Configure package.json with patched dependencies and overrides

## Phase 2: Database Schema & Migrations
- [ ] Integrate full drizzle schema (users, products, orders, categories, reviews, etc.)
- [ ] Push database migrations
- [ ] Verify database connectivity

## Phase 3: Server Integration
- [ ] Integrate server/db.ts with all query helpers
- [ ] Integrate server/routers.ts with all tRPC procedures
- [ ] Integrate admin-security.ts (2FA, sessions, password hashing)
- [ ] Integrate authz.ts (RBAC middleware)
- [ ] Integrate banner-api-routes.ts
- [ ] Integrate analytics-api-routes.ts
- [ ] Integrate category-api-routes.ts
- [ ] Integrate settings-api-routes.ts
- [ ] Integrate review-api-routes.ts
- [ ] Integrate chatbot-api-routes.ts
- [ ] Integrate coupon-api-routes.ts
- [ ] Integrate newsletter-api-routes.ts
- [ ] Integrate mobile-money.ts payment service
- [ ] Integrate email-service.ts
- [ ] Integrate image-upload.ts with S3 storage
- [ ] Integrate chatbot engine (chat-engine, llm-adapter, openai-concierge)
- [ ] Integrate coupon-service.ts
- [ ] Integrate safe-json.ts and newsletter-utils.ts

## Phase 4: Client Integration
- [ ] Integrate index.css with full brand theme
- [ ] Integrate App.tsx with all routes
- [ ] Integrate main.tsx with tRPC configuration
- [ ] Integrate Navbar component
- [ ] Integrate Footer component
- [ ] Integrate Home page with all sections
- [ ] Integrate Shop page with filters and search
- [ ] Integrate ProductDetail page
- [ ] Integrate Cart page
- [ ] Integrate Checkout page with Mobile Money
- [ ] Integrate OrderTracking page
- [ ] Integrate Admin dashboard
- [ ] Integrate AdminLogin with 2FA
- [ ] Integrate AdminCms page
- [ ] Integrate AdminSettings page
- [ ] Integrate AdminCategories page
- [ ] Integrate AdminCoupons page
- [ ] Integrate AdminChatbot page
- [ ] Integrate Chat page
- [ ] Integrate CartContext
- [ ] Integrate ThemeContext
- [ ] Integrate all hooks (useChatbotSession, useStorefrontSettings, etc.)
- [ ] Integrate all lib files (analyticsEvents, chatbotApi, reviewsApi, etc.)
- [ ] Integrate all storefront components
- [ ] Integrate all UI components

## Phase 5: Shared Types & Fixes
- [ ] Integrate shared types (admin-settings, chatbot, coupons, reviews, etc.)
- [ ] Fix import paths and dependencies
- [ ] Fix TypeScript errors

## Phase 6: Testing & Verification
- [ ] Run vitest tests
- [ ] Verify dev server starts correctly
- [ ] Verify homepage loads
- [ ] Verify shop page works
- [ ] Verify admin login works
- [ ] Fix any remaining issues

## Phase 7: Delivery
- [ ] Create checkpoint
- [ ] Push to GitHub
- [ ] Deliver to client
