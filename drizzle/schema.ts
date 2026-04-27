import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

// Admin credentials for password-protected login
export const adminCredentials = mysqlTable("admin_credentials", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  twoFactorEnabled: boolean("twoFactorEnabled").default(false).notNull(),
  twoFactorSecret: varchar("twoFactorSecret", { length: 255 }), // Base32 encoded secret for TOTP
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AdminCredential = typeof adminCredentials.$inferSelect;
export type InsertAdminCredential = typeof adminCredentials.$inferInsert;

// 2FA backup codes
export const twoFactorBackupCodes = mysqlTable("two_factor_backup_codes", {
  id: int("id").autoincrement().primaryKey(),
  adminCredentialId: int("adminCredentialId").notNull(),
  code: varchar("code", { length: 20 }).notNull(),
  used: boolean("used").default(false).notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TwoFactorBackupCode = typeof twoFactorBackupCodes.$inferSelect;

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Categories
export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  imageUrl: text("imageUrl"),
  coverImageUrl: text("cover_image_url"),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Category = typeof categories.$inferSelect;

// Products
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 500 }).notNull(),
  slug: varchar("slug", { length: 500 }).notNull().unique(),
  description: text("description"),
  benefitsJson: text("benefitsJson"),
  descriptionJson: text("descriptionJson"),
  routineJson: text("routineJson"),
  price: int("price").notNull(), // Price in CFA (integer, no decimals needed)
  comparePrice: int("comparePrice"), // Original price for showing discounts
  categoryId: int("categoryId").notNull(),
  imageUrl: text("imageUrl"),
  images: text("images"), // JSON array of image URLs
  inStock: boolean("inStock").default(true).notNull(),
  stockQuantity: int("stockQuantity").default(100).notNull(),
  isFeatured: boolean("isFeatured").default(false).notNull(),
  isNew: boolean("isNew").default(false).notNull(),
  isTrending: boolean("isTrending").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;

// Orders
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderNumber: varchar("orderNumber", { length: 20 }).notNull().unique(),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 20 }).notNull(),
  customerAddress: text("customerAddress").notNull(),
  customerCity: varchar("customerCity", { length: 100 }),
  subtotalAmount: int("subtotalAmount").default(0).notNull(),
  shippingFee: int("shippingFee").default(0).notNull(),
  couponCode: varchar("couponCode", { length: 80 }),
  discountAmount: int("discountAmount").default(0).notNull(),
  discountType: varchar("discountType", { length: 32 }),
  totalAmount: int("totalAmount").notNull(),
  totalPaid: int("totalPaid").default(0).notNull(),
  status: mysqlEnum("status", [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ])
    .default("pending")
    .notNull(),
  paymentMethod: varchar("paymentMethod", { length: 50 }).notNull(), // orange_money, wave, free_money
  paymentStatus: mysqlEnum("paymentStatus", [
    "pending",
    "processing",
    "completed",
    "failed",
  ])
    .default("pending")
    .notNull(),
  paymentReference: varchar("paymentReference", { length: 100 }),
  notes: text("notes"),
  userId: int("userId"), // nullable - guest checkout allowed
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Order = typeof orders.$inferSelect;

// Order Items
export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  productId: int("productId").notNull(),
  productName: varchar("productName", { length: 500 }).notNull(),
  productImage: text("productImage"),
  quantity: int("quantity").notNull(),
  unitPrice: int("unitPrice").notNull(),
  totalPrice: int("totalPrice").notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;

// Admin sessions for 2FA verification
export const adminSessions = mysqlTable("admin_sessions", {
  id: int("id").autoincrement().primaryKey(),
  adminCredentialId: int("adminCredentialId").notNull(),
  sessionToken: varchar("sessionToken", { length: 255 }).notNull().unique(),
  twoFactorVerified: boolean("twoFactorVerified").default(false).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdminSession = typeof adminSessions.$inferSelect;

// Page Views for analytics
export const pageViews = mysqlTable("page_views", {
  id: int("id").autoincrement().primaryKey(),
  page: varchar("page", { length: 500 }).notNull(),
  visitorId: varchar("visitorId", { length: 64 }).notNull(), // anonymous visitor ID
  sessionId: varchar("sessionId", { length: 64 }),
  referrer: text("referrer"),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PageView = typeof pageViews.$inferSelect;

// Generic Analytics Events (funnel + conversion telemetry)
export const analyticsEvents = mysqlTable("analytics_events", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", [
    "page_view",
    "add_to_cart",
    "checkout_start",
    "purchase",
  ]).notNull(),
  sessionId: varchar("sessionId", { length: 100 }).notNull(),
  userId: int("userId"),
  path: varchar("path", { length: 500 }).notNull(),
  meta: text("meta"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = typeof analyticsEvents.$inferInsert;

// Delivery Zones for checkout
export const deliveryZones = mysqlTable("delivery_zones", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  deliveryFee: int("deliveryFee").notNull(),
  deliveryDays: int("deliveryDays").default(2).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  displayOrder: int("displayOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DeliveryZone = typeof deliveryZones.$inferSelect;
export type InsertDeliveryZone = typeof deliveryZones.$inferInsert;

// Shipping Rates (threshold-based fees by zone)
export const shippingRates = mysqlTable("shipping_rates", {
  id: int("id").autoincrement().primaryKey(),
  zoneId: int("zoneId").notNull(),
  label: varchar("label", { length: 120 }).notNull(),
  minAmountCfa: int("minAmountCfa").default(0).notNull(),
  maxAmountCfa: int("maxAmountCfa"),
  feeCfa: int("feeCfa").default(0).notNull(),
  etaMinHours: int("etaMinHours").default(24).notNull(),
  etaMaxHours: int("etaMaxHours").default(72).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ShippingRate = typeof shippingRates.$inferSelect;
export type InsertShippingRate = typeof shippingRates.$inferInsert;

// Customers (for customer management)
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 320 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  totalOrders: int("totalOrders").default(0).notNull(),
  totalSpent: int("totalSpent").default(0).notNull(),
  lastOrderDate: timestamp("lastOrderDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

// Activity Logs (for tracking changes)
export const activityLogs = mysqlTable("activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  adminId: int("adminId").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 50 }).notNull(),
  entityId: int("entityId").notNull(),
  oldValues: text("oldValues"),
  newValues: text("newValues"),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;

// Audit logs with request metadata and before/after payloads
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  actorUserId: int("actorUserId"),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entityType", { length: 80 }).notNull(),
  entityId: varchar("entityId", { length: 120 }),
  beforeJson: text("beforeJson"),
  afterJson: text("afterJson"),
  ip: varchar("ip", { length: 120 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// Staff Accounts (for role-based access)
export const staffAccounts = mysqlTable("staff_accounts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["owner", "manager", "staff", "viewer"])
    .default("staff")
    .notNull(),
  permissions: text("permissions"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StaffAccount = typeof staffAccounts.$inferSelect;
export type InsertStaffAccount = typeof staffAccounts.$inferInsert;

// Store Settings
export const storeSettings = mysqlTable("store_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StoreSetting = typeof storeSettings.$inferSelect;
export type InsertStoreSetting = typeof storeSettings.$inferInsert;

// Structured settings for admin/settings tabs
export const settingsStore = mysqlTable("settings_store", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  logoUrl: text("logoUrl"),
  phone: varchar("phone", { length: 60 }),
  email: varchar("email", { length: 320 }),
  address: text("address"),
  currency: varchar("currency", { length: 20 }).default("CFA").notNull(),
  socials: text("socials"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SettingsStore = typeof settingsStore.$inferSelect;
export type InsertSettingsStore = typeof settingsStore.$inferInsert;

export const settingsPayments = mysqlTable("settings_payments", {
  id: int("id").autoincrement().primaryKey(),
  waveEnabled: boolean("waveEnabled").default(true).notNull(),
  omEnabled: boolean("omEnabled").default(true).notNull(),
  cardEnabled: boolean("cardEnabled").default(false).notNull(),
  waveKey: text("waveKey"),
  omKey: text("omKey"),
  cardPublicKey: text("cardPublicKey"),
  cardSecretKey: text("cardSecretKey"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SettingsPayments = typeof settingsPayments.$inferSelect;
export type InsertSettingsPayments = typeof settingsPayments.$inferInsert;

// CMS Pages
export const cmsPages = mysqlTable("cms_pages", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  status: mysqlEnum("status", ["draft", "published"])
    .default("draft")
    .notNull(),
  content: text("content").notNull(),
  seoTitle: varchar("seoTitle", { length: 255 }),
  seoDescription: text("seoDescription"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CmsPage = typeof cmsPages.$inferSelect;
export type InsertCmsPage = typeof cmsPages.$inferInsert;

// Homepage Results Section (Avant/Apres + metrics)
export const cmsResultsSection = mysqlTable("cms_results_section", {
  id: int("id").autoincrement().primaryKey(),
  enabled: boolean("enabled").default(true).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  subtitle: text("subtitle").notNull(),
  beforeLabel: varchar("beforeLabel", { length: 50 })
    .default("AVANT")
    .notNull(),
  afterLabel: varchar("afterLabel", { length: 50 }).default("APRES").notNull(),
  beforeImageUrl: text("beforeImageUrl"),
  afterImageUrl: text("afterImageUrl"),
  stat1Value: varchar("stat1Value", { length: 80 }).notNull(),
  stat1Title: varchar("stat1Title", { length: 120 }).notNull(),
  stat1Desc: text("stat1Desc").notNull(),
  stat2Value: varchar("stat2Value", { length: 80 }).notNull(),
  stat2Title: varchar("stat2Title", { length: 120 }).notNull(),
  stat2Desc: text("stat2Desc").notNull(),
  stat3Value: varchar("stat3Value", { length: 80 }).notNull(),
  stat3Title: varchar("stat3Title", { length: 120 }).notNull(),
  stat3Desc: text("stat3Desc").notNull(),
  footerNote: text("footerNote").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CmsResultsSection = typeof cmsResultsSection.$inferSelect;
export type InsertCmsResultsSection = typeof cmsResultsSection.$inferInsert;

// Homepage Editorial Hero (single row id=1)
export const cmsEditorialHero = mysqlTable("cms_editorial_hero", {
  id: int("id").primaryKey().default(1).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  badgeText: text("badgeText").notNull(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull(),
  ctaText: text("ctaText").notNull(),
  ctaLink: text("ctaLink").notNull(),
  backgroundImageUrl: text("backgroundImageUrl").notNull(),
  overlayOpacity: int("overlayOpacity").default(55).notNull(),
  cardPosition: mysqlEnum("cardPosition", ["left", "center", "right"])
    .default("left")
    .notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CmsEditorialHero = typeof cmsEditorialHero.$inferSelect;
export type InsertCmsEditorialHero = typeof cmsEditorialHero.$inferInsert;

// Product Variants (for product options like size, color)
export const productVariants = mysqlTable("product_variants", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  values: text("values").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProductVariant = typeof productVariants.$inferSelect;
export type InsertProductVariant = typeof productVariants.$inferInsert;

// Order Notes (for internal team communication)
export const orderNotes = mysqlTable("order_notes", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  adminId: int("adminId").notNull(),
  note: text("note").notNull(),
  isInternal: boolean("isInternal").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrderNote = typeof orderNotes.$inferSelect;
export type InsertOrderNote = typeof orderNotes.$inferInsert;

// Product Reviews & Ratings
export const productReviews = mysqlTable("product_reviews", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  orderId: int("orderId"), // Link to verified purchase
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerEmail: varchar("customerEmail", { length: 320 }),
  rating: int("rating").notNull(), // 1-5 stars
  title: varchar("title", { length: 255 }).notNull(),
  comment: text("comment"),
  isVerifiedPurchase: boolean("isVerifiedPurchase").default(false).notNull(),
  isApproved: boolean("isApproved").default(false).notNull(),
  helpfulCount: int("helpfulCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductReview = typeof productReviews.$inferSelect;
export type InsertProductReview = typeof productReviews.$inferInsert;

// Reviews (status-based moderation pipeline)
export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  orderId: int("orderId"),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerEmail: varchar("customerEmail", { length: 320 }),
  rating: int("rating").notNull(),
  title: varchar("title", { length: 255 }),
  body: text("body").notNull(),
  images: text("images"),
  status: mysqlEnum("status", ["pending", "approved", "rejected"])
    .default("pending")
    .notNull(),
  isVerifiedPurchase: boolean("isVerifiedPurchase").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Review = typeof reviews.$inferSelect;
export type InsertReview = typeof reviews.$inferInsert;

export const reviewReplies = mysqlTable("review_replies", {
  id: int("id").autoincrement().primaryKey(),
  reviewId: int("reviewId").notNull(),
  adminUserId: int("adminUserId"),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ReviewReply = typeof reviewReplies.$inferSelect;
export type InsertReviewReply = typeof reviewReplies.$inferInsert;

// Wishlist
export const wishlists = mysqlTable("wishlists", {
  id: int("id").autoincrement().primaryKey(),
  customerEmail: varchar("customerEmail", { length: 320 }).notNull(),
  productId: int("productId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Wishlist = typeof wishlists.$inferSelect;
export type InsertWishlist = typeof wishlists.$inferInsert;

export const carts = mysqlTable("carts", {
  id: varchar("id", { length: 191 }).primaryKey(),
  sessionId: varchar("sessionId", { length: 120 }).notNull().unique(),
  userId: int("userId"),
  deliveryZoneId: int("deliveryZoneId"),
  subtotalAmount: int("subtotalAmount").default(0).notNull(),
  shippingFee: int("shippingFee").default(0).notNull(),
  couponCode: varchar("couponCode", { length: 80 }),
  discountAmount: int("discountAmount").default(0).notNull(),
  discountType: varchar("discountType", { length: 32 }),
  totalAmount: int("totalAmount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Cart = typeof carts.$inferSelect;
export type InsertCart = typeof carts.$inferInsert;

export const cartItems = mysqlTable("cart_items", {
  id: varchar("id", { length: 191 }).primaryKey(),
  cartId: varchar("cartId", { length: 191 }).notNull(),
  productId: int("productId").notNull(),
  quantity: int("quantity").notNull(),
  unitPrice: int("unitPrice").notNull(),
  totalPrice: int("totalPrice").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = typeof cartItems.$inferInsert;

// Coupon Codes
export const coupons = mysqlTable("coupons", {
  id: varchar("id", { length: 191 }).primaryKey(),
  code: varchar("code", { length: 80 }).notNull().unique(),
  type: mysqlEnum("type", ["PERCENT", "FIXED", "FREE_SHIPPING"]).notNull(),
  value: int("value").notNull(),
  minSubtotal: int("minSubtotal").default(0).notNull(),
  maxDiscount: int("maxDiscount"),
  startAt: timestamp("startAt"),
  endAt: timestamp("endAt"),
  usageLimit: int("usageLimit"),
  perSessionLimit: int("perSessionLimit"),
  active: boolean("active").default(true).notNull(),
  appliesTo: mysqlEnum("appliesTo", ["ALL", "CATEGORY", "PRODUCT"])
    .default("ALL")
    .notNull(),
  categoryId: varchar("categoryId", { length: 191 }),
  productId: varchar("productId", { length: 191 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = typeof coupons.$inferInsert;

export const couponRedemptions = mysqlTable("coupon_redemptions", {
  id: varchar("id", { length: 191 }).primaryKey(),
  couponId: varchar("couponId", { length: 191 }).notNull(),
  sessionId: varchar("sessionId", { length: 120 }).notNull(),
  userId: varchar("userId", { length: 120 }),
  orderId: varchar("orderId", { length: 120 }),
  redeemedAt: timestamp("redeemedAt").defaultNow().notNull(),
});

export type CouponRedemption = typeof couponRedemptions.$inferSelect;
export type InsertCouponRedemption = typeof couponRedemptions.$inferInsert;

// Flash Sales
export const flashSales = mysqlTable("flash_sales", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  discountPercentage: int("discountPercentage").notNull(),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FlashSale = typeof flashSales.$inferSelect;
export type InsertFlashSale = typeof flashSales.$inferInsert;

// Referral Program
export const referrals = mysqlTable("referrals", {
  id: int("id").autoincrement().primaryKey(),
  referrerEmail: varchar("referrerEmail", { length: 320 }).notNull(),
  referralCode: varchar("referralCode", { length: 20 }).notNull().unique(),
  referredEmail: varchar("referredEmail", { length: 320 }),
  rewardAmount: int("rewardAmount").default(5000).notNull(), // In CFA
  isRedeemed: boolean("isRedeemed").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = typeof referrals.$inferInsert;

// Customer Saved Addresses
export const savedAddresses = mysqlTable("saved_addresses", {
  id: int("id").autoincrement().primaryKey(),
  customerEmail: varchar("customerEmail", { length: 320 }).notNull(),
  label: varchar("label", { length: 50 }), // "Home", "Work", etc.
  fullName: varchar("fullName", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  address: text("address").notNull(),
  deliveryZoneId: int("deliveryZoneId"),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SavedAddress = typeof savedAddresses.$inferSelect;
export type InsertSavedAddress = typeof savedAddresses.$inferInsert;

// Email Subscriptions
export const emailSubscriptions = mysqlTable("email_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  isSubscribed: boolean("isSubscribed").default(true).notNull(),
  subscriptionType: mysqlEnum("subscriptionType", [
    "all",
    "promotions",
    "orders",
    "none",
  ])
    .default("all")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmailSubscription = typeof emailSubscriptions.$inferSelect;
export type InsertEmailSubscription = typeof emailSubscriptions.$inferInsert;

export const newsletterSubscribers = mysqlTable("newsletter_subscribers", {
  id: varchar("id", { length: 191 }).primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  // PENDING = awaiting RGPD double-opt-in confirmation; SUBSCRIBED = confirmed;
  // UNSUBSCRIBED = on the suppression list (PII fields are cleared on this transition).
  status: mysqlEnum("status", ["PENDING", "SUBSCRIBED", "UNSUBSCRIBED"])
    .default("PENDING")
    .notNull(),
  source: varchar("source", { length: 64 }),
  locale: varchar("locale", { length: 16 }),
  ip: varchar("ip", { length: 64 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  unsubscribedAt: timestamp("unsubscribedAt"),
  confirmationToken: varchar("confirmationToken", { length: 128 }),
  confirmationTokenExpiresAt: timestamp("confirmationTokenExpiresAt"),
  confirmedAt: timestamp("confirmedAt"),
});

export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type InsertNewsletterSubscriber =
  typeof newsletterSubscribers.$inferInsert;

// Live Chat Messages
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  // Legacy fields (kept for backward compatibility with older chat endpoints/data)
  sessionId: varchar("sessionId", { length: 100 }),
  customerName: varchar("customerName", { length: 255 }),
  customerEmail: varchar("customerEmail", { length: 320 }),
  message: text("message"),
  isFromCustomer: boolean("isFromCustomer"),
  staffId: int("staffId"),
  // New chatbot platform fields
  threadId: int("threadId"),
  role: mysqlEnum("role", ["user", "assistant", "system"])
    .default("user")
    .notNull(),
  content: text("content"),
  meta: text("meta"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

export const chatThreads = mysqlTable("chat_threads", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 120 }),
  visitorId: varchar("visitorId", { length: 100 }).notNull(),
  userId: int("userId"),
  locale: varchar("locale", { length: 16 }).default("fr-SN").notNull(),
  status: mysqlEnum("status", ["open", "closed"]).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChatThread = typeof chatThreads.$inferSelect;
export type InsertChatThread = typeof chatThreads.$inferInsert;

export const chatKbArticles = mysqlTable("chat_kb_articles", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  tags: text("tags"),
  locale: varchar("locale", { length: 16 }).default("fr-SN").notNull(),
  isPublished: boolean("isPublished").default(true).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatKbArticle = typeof chatKbArticles.$inferSelect;
export type InsertChatKbArticle = typeof chatKbArticles.$inferInsert;

export const chatIntents = mysqlTable("chat_intents", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  triggers: text("triggers"),
  responseTemplate: text("responseTemplate"),
  tool: text("tool"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChatIntent = typeof chatIntents.$inferSelect;
export type InsertChatIntent = typeof chatIntents.$inferInsert;

export const chatSettings = mysqlTable("chat_settings", {
  id: int("id").autoincrement().primaryKey(),
  businessName: varchar("businessName", { length: 160 })
    .default("SenBonsPlans")
    .notNull(),
  whatsappNumber: varchar("whatsappNumber", { length: 40 })
    .default("+221788911010")
    .notNull(),
  welcomeMessage: text("welcomeMessage").notNull(),
  primaryColor: varchar("primaryColor", { length: 20 })
    .default("#8f5f68")
    .notNull(),
  botTone: mysqlEnum("botTone", ["luxury_skincare", "friendly", "professional"])
    .default("luxury_skincare")
    .notNull(),
  enabledTools: text("enabledTools"),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatSettings = typeof chatSettings.$inferSelect;
export type InsertChatSettings = typeof chatSettings.$inferInsert;

export const adminChatSettings = mysqlTable("admin_chat_settings", {
  id: int("id").primaryKey().notNull(),
  greeting: text("greeting").notNull(),
  tone: mysqlEnum("tone", ["Luxury skincare", "Friendly", "Professional"])
    .default("Luxury skincare")
    .notNull(),
  whatsappNumber: varchar("whatsappNumber", { length: 40 }).notNull(),
  policies: text("policies").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdminChatSettings = typeof adminChatSettings.$inferSelect;
export type InsertAdminChatSettings = typeof adminChatSettings.$inferInsert;

export const chatTickets = mysqlTable("chat_tickets", {
  id: int("id").autoincrement().primaryKey(),
  threadId: int("threadId").notNull(),
  message: text("message").notNull(),
  phone: varchar("phone", { length: 40 }),
  status: mysqlEnum("status", ["open", "closed"]).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChatTicket = typeof chatTickets.$inferSelect;
export type InsertChatTicket = typeof chatTickets.$inferInsert;

export const chatEvents = mysqlTable("chat_events", {
  id: int("id").autoincrement().primaryKey(),
  type: varchar("type", { length: 80 }).notNull(),
  threadId: int("threadId"),
  payload: text("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatEvent = typeof chatEvents.$inferSelect;
export type InsertChatEvent = typeof chatEvents.$inferInsert;

// Promotional Banners
export const banners = mysqlTable("banners", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  imageUrl: text("imageUrl"),
  imageUrlDesktop: text("imageUrlDesktop"),
  imageUrlMobile: text("imageUrlMobile"),
  cropMeta: text("cropMeta"),
  backgroundColor: varchar("backgroundColor", { length: 7 }).default("#C41E3A"), // Crimson default
  textColor: varchar("textColor", { length: 7 }).default("#FFFFFF"),
  buttonText: varchar("buttonText", { length: 100 }),
  buttonLink: text("buttonLink"),
  position: mysqlEnum("position", [
    "top",
    "bottom",
    "sidebar",
    "hero",
    "custom",
  ])
    .default("top")
    .notNull(),
  displayOn: mysqlEnum("displayOn", ["homepage", "shop", "all", "custom"])
    .default("all")
    .notNull(),
  layout: mysqlEnum("layout", [
    "full-width",
    "centered",
    "side-by-side",
    "overlay",
  ])
    .default("full-width")
    .notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Banner = typeof banners.$inferSelect;
export type InsertBanner = typeof banners.$inferInsert;
