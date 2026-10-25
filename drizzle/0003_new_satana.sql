CREATE TABLE `godmode_world_archives` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`from_tick` integer NOT NULL,
	`to_tick` integer NOT NULL,
	`final_hash` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `godmode_archive_hash` ON `godmode_world_archives` (`run_id`,`final_hash`);