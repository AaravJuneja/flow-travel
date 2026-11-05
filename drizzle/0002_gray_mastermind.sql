CREATE TABLE `ai_usage` (
	`key` text PRIMARY KEY NOT NULL,
	`requests` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `route_options` ADD `details` text;--> statement-breakpoint
ALTER TABLE `trips` ADD `planner_notes` text DEFAULT '' NOT NULL;