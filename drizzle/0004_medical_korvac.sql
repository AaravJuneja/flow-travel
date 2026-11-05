CREATE TABLE `route_research` (
	`id` text PRIMARY KEY NOT NULL,
	`origin_code` text NOT NULL,
	`destination_code` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`publisher` text NOT NULL,
	`text` text NOT NULL,
	`checked_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `research_city_pair_idx` ON `route_research` (`origin_code`,`destination_code`);