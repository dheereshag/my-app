CREATE TABLE `attendees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booking_id` integer NOT NULL,
	`kind` text NOT NULL,
	`full_name` text NOT NULL,
	`age` integer NOT NULL,
	`phone` text,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `attendees_booking_id_idx` ON `attendees` (`booking_id`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reference` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`request_hash` text NOT NULL,
	`booker_name` text NOT NULL,
	`booker_email` text NOT NULL,
	`booker_phone` text NOT NULL,
	`promo_code` text,
	`subtotal_cents` integer NOT NULL,
	`discount_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`confirmation_json` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_reference_unique` ON `bookings` (`reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_idempotency_key_unique` ON `bookings` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `promo_usage` (
	`code` text PRIMARY KEY NOT NULL,
	`used_count` integer DEFAULT 0 NOT NULL,
	`max_uses` integer,
	CONSTRAINT "promo_usage_within_limit" CHECK("promo_usage"."max_uses" IS NULL OR "promo_usage"."used_count" <= "promo_usage"."max_uses")
);
--> statement-breakpoint
CREATE TABLE `stock` (
	`sku` text PRIMARY KEY NOT NULL,
	`remaining` integer NOT NULL,
	CONSTRAINT "stock_remaining_non_negative" CHECK("stock"."remaining" >= 0)
);
