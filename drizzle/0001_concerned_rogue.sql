ALTER TABLE `newsletter_subscribers` MODIFY COLUMN `status` enum('PENDING','SUBSCRIBED','UNSUBSCRIBED') NOT NULL DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE `newsletter_subscribers` ADD `confirmationToken` varchar(128);--> statement-breakpoint
ALTER TABLE `newsletter_subscribers` ADD `confirmationTokenExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `newsletter_subscribers` ADD `confirmedAt` timestamp;