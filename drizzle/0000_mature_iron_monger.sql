CREATE TABLE `itinerary_segments` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`route_option_id` text NOT NULL,
	`position` integer NOT NULL,
	`mode` text NOT NULL,
	`from_name` text NOT NULL,
	`to_name` text NOT NULL,
	`departure_time` text NOT NULL,
	`arrival_time` text NOT NULL,
	`status` text DEFAULT 'upcoming' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`route_option_id`) REFERENCES `route_options`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `itinerary_trip_position_idx` ON `itinerary_segments` (`trip_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `itinerary_option_position_idx` ON `itinerary_segments` (`route_option_id`,`position`);--> statement-breakpoint
CREATE TABLE `journey_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`type` text NOT NULL,
	`message` text NOT NULL,
	`delay_minutes` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `journey_events_trip_time_idx` ON `journey_events` (`trip_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `payment_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`provider_reference` text,
	`amount_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payment_trip_idx` ON `payment_records` (`trip_id`);--> statement-breakpoint
CREATE TABLE `route_options` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`title` text NOT NULL,
	`mode` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`price_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`changes` integer NOT NULL,
	`summary` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `route_options_trip_idx` ON `route_options` (`trip_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `trips` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`origin_code` text NOT NULL,
	`origin_name` text NOT NULL,
	`destination_code` text NOT NULL,
	`destination_name` text NOT NULL,
	`departure_date` text NOT NULL,
	`departure_time` text NOT NULL,
	`travelers` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'planning' NOT NULL,
	`selected_option_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trips_user_updated_idx` ON `trips` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `wallet_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`reference_code` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_trip_idx` ON `wallet_items` (`trip_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_reference_idx` ON `wallet_items` (`reference_code`);