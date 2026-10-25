CREATE TABLE `godmode_commands` (
	`run_id` text NOT NULL,
	`command_id` text NOT NULL,
	`revision` integer NOT NULL,
	PRIMARY KEY(`run_id`, `command_id`)
);
--> statement-breakpoint
CREATE TABLE `godmode_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`ticket_id` text NOT NULL,
	`status` text NOT NULL,
	`reserved_micro` integer NOT NULL,
	`actual_micro` integer,
	`result_json` text,
	`error_code` text,
	`dispatched_at` integer,
	`created_at` integer NOT NULL,
	`guard` integer NOT NULL,
	CONSTRAINT "job_guard" CHECK("godmode_jobs"."guard"=1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `godmode_job_ticket` ON `godmode_jobs` (`run_id`,`ticket_id`);--> statement-breakpoint
CREATE INDEX `godmode_jobs_run` ON `godmode_jobs` (`run_id`,`status`);--> statement-breakpoint
CREATE TABLE `godmode_operations` (
	`run_id` text NOT NULL,
	`revision` integer NOT NULL,
	`kind` text NOT NULL,
	`payload_json` text NOT NULL,
	`state_hash` text NOT NULL,
	`guard` integer NOT NULL,
	PRIMARY KEY(`run_id`, `revision`),
	CONSTRAINT "operation_guard" CHECK("godmode_operations"."guard"=1)
);
--> statement-breakpoint
CREATE TABLE `godmode_receipts` (
	`job_id` text PRIMARY KEY NOT NULL,
	`guard` integer NOT NULL,
	CONSTRAINT "receipt_guard" CHECK("godmode_receipts"."guard"=1)
);
--> statement-breakpoint
CREATE TABLE `godmode_requests` (
	`job_id` text NOT NULL,
	`kind` text NOT NULL,
	`guard` integer NOT NULL,
	PRIMARY KEY(`job_id`, `kind`),
	CONSTRAINT "request_guard" CHECK("godmode_requests"."guard"=1)
);
--> statement-breakpoint
CREATE TABLE `godmode_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`mode` text NOT NULL,
	`state_json` text NOT NULL,
	`parent_id` text,
	`created_at` text NOT NULL,
	`lease_token` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`reserved_micro` integer DEFAULT 0 NOT NULL,
	`spent_micro` integer DEFAULT 0 NOT NULL,
	`generation_attempts` integer DEFAULT 0 NOT NULL,
	`http_requests` integer DEFAULT 0 NOT NULL,
	`event_admitted` integer DEFAULT 0 NOT NULL,
	`budget_micro` integer DEFAULT 3000000 NOT NULL
);
