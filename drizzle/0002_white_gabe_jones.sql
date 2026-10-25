CREATE TABLE `godmode_world_tick_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`run_id` text NOT NULL,
	`expected_revision` integer NOT NULL,
	`tick_before` integer NOT NULL,
	`requested_seconds` integer NOT NULL,
	`actual_seconds` integer,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`error_code` text,
	`guard` integer NOT NULL,
	CONSTRAINT "world_tick_guard" CHECK("godmode_world_tick_jobs"."guard"=1)
);
--> statement-breakpoint
CREATE INDEX `godmode_world_ticks_recent` ON `godmode_world_tick_jobs` (`world_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `godmode_worlds` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`paused` integer DEFAULT 0 NOT NULL,
	`pace_milli` integer DEFAULT 100 NOT NULL,
	`last_wall_ms` integer NOT NULL,
	`owed_sim_ms` integer DEFAULT 0 NOT NULL,
	`lease_token` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`pending_job_id` text,
	`last_tick_at` text,
	`last_background_tick_at` text,
	`last_error` text,
	`created_at` text NOT NULL
);
