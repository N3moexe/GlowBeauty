CREATE TABLE IF NOT EXISTS `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminId` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`entityType` varchar(50) NOT NULL,
	`entityId` int NOT NULL,
	`oldValues` text,
	`newValues` text,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `admin_chat_settings` (
	`id` int NOT NULL,
	`greeting` text NOT NULL,
	`tone` enum('Luxury skincare','Friendly','Professional') NOT NULL DEFAULT 'Luxury skincare',
	`whatsappNumber` varchar(40) NOT NULL,
	`policies` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_chat_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `admin_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`username` varchar(255) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`twoFactorEnabled` boolean NOT NULL DEFAULT false,
	`twoFactorSecret` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_credentials_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `admin_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminCredentialId` int NOT NULL,
	`sessionToken` varchar(255) NOT NULL,
	`twoFactorVerified` boolean NOT NULL DEFAULT false,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_sessions_sessionToken_unique` UNIQUE(`sessionToken`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `analytics_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('page_view','add_to_cart','checkout_start','purchase') NOT NULL,
	`sessionId` varchar(100) NOT NULL,
	`userId` int,
	`path` varchar(500) NOT NULL,
	`meta` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analytics_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int,
	`action` varchar(120) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` varchar(120),
	`beforeJson` text,
	`afterJson` text,
	`ip` varchar(120),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `banners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`imageUrl` text,
	`imageUrlDesktop` text,
	`imageUrlMobile` text,
	`cropMeta` text,
	`backgroundColor` varchar(7) DEFAULT '#C41E3A',
	`textColor` varchar(7) DEFAULT '#FFFFFF',
	`buttonText` varchar(100),
	`buttonLink` text,
	`position` enum('top','bottom','sidebar','hero','custom') NOT NULL DEFAULT 'top',
	`displayOn` enum('homepage','shop','all','custom') NOT NULL DEFAULT 'all',
	`layout` enum('full-width','centered','side-by-side','overlay') NOT NULL DEFAULT 'full-width',
	`isActive` boolean NOT NULL DEFAULT true,
	`startDate` timestamp,
	`endDate` timestamp,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `banners_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `cart_items` (
	`id` varchar(191) NOT NULL,
	`cartId` varchar(191) NOT NULL,
	`productId` int NOT NULL,
	`quantity` int NOT NULL,
	`unitPrice` int NOT NULL,
	`totalPrice` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cart_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `carts` (
	`id` varchar(191) NOT NULL,
	`sessionId` varchar(120) NOT NULL,
	`userId` int,
	`deliveryZoneId` int,
	`subtotalAmount` int NOT NULL DEFAULT 0,
	`shippingFee` int NOT NULL DEFAULT 0,
	`couponCode` varchar(80),
	`discountAmount` int NOT NULL DEFAULT 0,
	`discountType` varchar(32),
	`totalAmount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `carts_id` PRIMARY KEY(`id`),
	CONSTRAINT `carts_sessionId_unique` UNIQUE(`sessionId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` text,
	`imageUrl` text,
	`cover_image_url` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `chat_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` varchar(80) NOT NULL,
	`threadId` int,
	`payload` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `chat_intents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`triggers` text,
	`responseTemplate` text,
	`tool` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chat_intents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `chat_kb_articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`tags` text,
	`locale` varchar(16) NOT NULL DEFAULT 'fr-SN',
	`isPublished` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_kb_articles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(100),
	`customerName` varchar(255),
	`customerEmail` varchar(320),
	`message` text,
	`isFromCustomer` boolean,
	`staffId` int,
	`threadId` int,
	`role` enum('user','assistant','system') NOT NULL DEFAULT 'user',
	`content` text,
	`meta` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `chat_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessName` varchar(160) NOT NULL DEFAULT 'SenBonsPlans',
	`whatsappNumber` varchar(40) NOT NULL DEFAULT '+221788911010',
	`welcomeMessage` text NOT NULL,
	`primaryColor` varchar(20) NOT NULL DEFAULT '#8f5f68',
	`botTone` enum('luxury_skincare','friendly','professional') NOT NULL DEFAULT 'luxury_skincare',
	`enabledTools` text,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `chat_threads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(120),
	`visitorId` varchar(100) NOT NULL,
	`userId` int,
	`locale` varchar(16) NOT NULL DEFAULT 'fr-SN',
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chat_threads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `chat_tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`threadId` int NOT NULL,
	`message` text NOT NULL,
	`phone` varchar(40),
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chat_tickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `cms_editorial_hero` (
	`id` int NOT NULL DEFAULT 1,
	`isActive` boolean NOT NULL DEFAULT true,
	`badgeText` text NOT NULL,
	`title` text NOT NULL,
	`subtitle` text NOT NULL,
	`ctaText` text NOT NULL,
	`ctaLink` text NOT NULL,
	`backgroundImageUrl` text NOT NULL,
	`overlayOpacity` int NOT NULL DEFAULT 55,
	`cardPosition` enum('left','center','right') NOT NULL DEFAULT 'left',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cms_editorial_hero_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `cms_pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`content` text NOT NULL,
	`seoTitle` varchar(255),
	`seoDescription` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cms_pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `cms_pages_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `cms_results_section` (
	`id` int AUTO_INCREMENT NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`title` varchar(255) NOT NULL,
	`subtitle` text NOT NULL,
	`beforeLabel` varchar(50) NOT NULL DEFAULT 'AVANT',
	`afterLabel` varchar(50) NOT NULL DEFAULT 'APRES',
	`beforeImageUrl` text,
	`afterImageUrl` text,
	`stat1Value` varchar(80) NOT NULL,
	`stat1Title` varchar(120) NOT NULL,
	`stat1Desc` text NOT NULL,
	`stat2Value` varchar(80) NOT NULL,
	`stat2Title` varchar(120) NOT NULL,
	`stat2Desc` text NOT NULL,
	`stat3Value` varchar(80) NOT NULL,
	`stat3Title` varchar(120) NOT NULL,
	`stat3Desc` text NOT NULL,
	`footerNote` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cms_results_section_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `coupon_redemptions` (
	`id` varchar(191) NOT NULL,
	`couponId` varchar(191) NOT NULL,
	`sessionId` varchar(120) NOT NULL,
	`userId` varchar(120),
	`orderId` varchar(120),
	`redeemedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coupon_redemptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `coupons` (
	`id` varchar(191) NOT NULL,
	`code` varchar(80) NOT NULL,
	`type` enum('PERCENT','FIXED','FREE_SHIPPING') NOT NULL,
	`value` int NOT NULL,
	`minSubtotal` int NOT NULL DEFAULT 0,
	`maxDiscount` int,
	`startAt` timestamp,
	`endAt` timestamp,
	`usageLimit` int,
	`perSessionLimit` int,
	`active` boolean NOT NULL DEFAULT true,
	`appliesTo` enum('ALL','CATEGORY','PRODUCT') NOT NULL DEFAULT 'ALL',
	`categoryId` varchar(191),
	`productId` varchar(191),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `coupons_id` PRIMARY KEY(`id`),
	CONSTRAINT `coupons_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`email` varchar(320),
	`address` text,
	`city` varchar(100),
	`totalOrders` int NOT NULL DEFAULT 0,
	`totalSpent` int NOT NULL DEFAULT 0,
	`lastOrderDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `delivery_zones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` text,
	`deliveryFee` int NOT NULL,
	`deliveryDays` int NOT NULL DEFAULT 2,
	`isActive` boolean NOT NULL DEFAULT true,
	`displayOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `delivery_zones_id` PRIMARY KEY(`id`),
	CONSTRAINT `delivery_zones_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `email_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`isSubscribed` boolean NOT NULL DEFAULT true,
	`subscriptionType` enum('all','promotions','orders','none') NOT NULL DEFAULT 'all',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_subscriptions_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `flash_sales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`discountPercentage` int NOT NULL,
	`startTime` timestamp NOT NULL,
	`endTime` timestamp NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `flash_sales_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `newsletter_subscribers` (
	`id` varchar(191) NOT NULL,
	`email` varchar(320) NOT NULL,
	`status` enum('SUBSCRIBED','UNSUBSCRIBED') NOT NULL DEFAULT 'SUBSCRIBED',
	`source` varchar(64),
	`locale` varchar(16),
	`ip` varchar(64),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`unsubscribedAt` timestamp,
	CONSTRAINT `newsletter_subscribers_id` PRIMARY KEY(`id`),
	CONSTRAINT `newsletter_subscribers_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int NOT NULL,
	`productName` varchar(500) NOT NULL,
	`productImage` text,
	`quantity` int NOT NULL,
	`unitPrice` int NOT NULL,
	`totalPrice` int NOT NULL,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `order_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`adminId` int NOT NULL,
	`note` text NOT NULL,
	`isInternal` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNumber` varchar(20) NOT NULL,
	`customerName` varchar(255) NOT NULL,
	`customerPhone` varchar(20) NOT NULL,
	`customerAddress` text NOT NULL,
	`customerCity` varchar(100),
	`subtotalAmount` int NOT NULL DEFAULT 0,
	`shippingFee` int NOT NULL DEFAULT 0,
	`couponCode` varchar(80),
	`discountAmount` int NOT NULL DEFAULT 0,
	`discountType` varchar(32),
	`totalAmount` int NOT NULL,
	`totalPaid` int NOT NULL DEFAULT 0,
	`status` enum('pending','confirmed','processing','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
	`paymentMethod` varchar(50) NOT NULL,
	`paymentStatus` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`paymentReference` varchar(100),
	`notes` text,
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_orderNumber_unique` UNIQUE(`orderNumber`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `page_views` (
	`id` int AUTO_INCREMENT NOT NULL,
	`page` varchar(500) NOT NULL,
	`visitorId` varchar(64) NOT NULL,
	`sessionId` varchar(64),
	`referrer` text,
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `page_views_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `product_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`orderId` int,
	`customerName` varchar(255) NOT NULL,
	`customerEmail` varchar(320),
	`rating` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`comment` text,
	`isVerifiedPurchase` boolean NOT NULL DEFAULT false,
	`isApproved` boolean NOT NULL DEFAULT false,
	`helpfulCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `product_variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`values` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_variants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(500) NOT NULL,
	`slug` varchar(500) NOT NULL,
	`description` text,
	`benefitsJson` text,
	`descriptionJson` text,
	`routineJson` text,
	`price` int NOT NULL,
	`comparePrice` int,
	`categoryId` int NOT NULL,
	`imageUrl` text,
	`images` text,
	`inStock` boolean NOT NULL DEFAULT true,
	`stockQuantity` int NOT NULL DEFAULT 100,
	`isFeatured` boolean NOT NULL DEFAULT false,
	`isNew` boolean NOT NULL DEFAULT false,
	`isTrending` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `referrals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referrerEmail` varchar(320) NOT NULL,
	`referralCode` varchar(20) NOT NULL,
	`referredEmail` varchar(320),
	`rewardAmount` int NOT NULL DEFAULT 5000,
	`isRedeemed` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referrals_id` PRIMARY KEY(`id`),
	CONSTRAINT `referrals_referralCode_unique` UNIQUE(`referralCode`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `review_replies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reviewId` int NOT NULL,
	`adminUserId` int,
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `review_replies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`orderId` int,
	`customerName` varchar(255) NOT NULL,
	`customerEmail` varchar(320),
	`rating` int NOT NULL,
	`title` varchar(255),
	`body` text NOT NULL,
	`images` text,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`isVerifiedPurchase` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `saved_addresses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerEmail` varchar(320) NOT NULL,
	`label` varchar(50),
	`fullName` varchar(255) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`address` text NOT NULL,
	`deliveryZoneId` int,
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saved_addresses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `settings_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`waveEnabled` boolean NOT NULL DEFAULT true,
	`omEnabled` boolean NOT NULL DEFAULT true,
	`cardEnabled` boolean NOT NULL DEFAULT false,
	`waveKey` text,
	`omKey` text,
	`cardPublicKey` text,
	`cardSecretKey` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `settings_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `settings_store` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`logoUrl` text,
	`phone` varchar(60),
	`email` varchar(320),
	`address` text,
	`currency` varchar(20) NOT NULL DEFAULT 'CFA',
	`socials` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `settings_store_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `shipping_rates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`zoneId` int NOT NULL,
	`label` varchar(120) NOT NULL,
	`minAmountCfa` int NOT NULL DEFAULT 0,
	`maxAmountCfa` int,
	`feeCfa` int NOT NULL DEFAULT 0,
	`etaMinHours` int NOT NULL DEFAULT 24,
	`etaMaxHours` int NOT NULL DEFAULT 72,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shipping_rates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `staff_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','manager','staff','viewer') NOT NULL DEFAULT 'staff',
	`permissions` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staff_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `store_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `store_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `store_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `two_factor_backup_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminCredentialId` int NOT NULL,
	`code` varchar(20) NOT NULL,
	`used` boolean NOT NULL DEFAULT false,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `two_factor_backup_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `wishlists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerEmail` varchar(320) NOT NULL,
	`productId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wishlists_id` PRIMARY KEY(`id`)
);
