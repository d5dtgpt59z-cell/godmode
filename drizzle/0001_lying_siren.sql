CREATE TABLE `godmode_imported_audits` (
	`run_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`payload_json` text NOT NULL,
	PRIMARY KEY(`run_id`, `sequence`)
);
--> statement-breakpoint
CREATE TABLE `godmode_project_budget` (
	`id` text PRIMARY KEY NOT NULL,
	`limit_micro` integer NOT NULL,
	`reserved_micro` integer DEFAULT 0 NOT NULL,
	`spent_micro` integer DEFAULT 0 NOT NULL,
	`generation_attempts` integer DEFAULT 0 NOT NULL,
	`http_requests` integer DEFAULT 0 NOT NULL
);
