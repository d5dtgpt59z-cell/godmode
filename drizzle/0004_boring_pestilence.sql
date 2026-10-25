CREATE TABLE `godmode_cozy_archives` (
	`id` text PRIMARY KEY NOT NULL,
	`save_id` text NOT NULL,
	`from_step` integer NOT NULL,
	`to_step` integer NOT NULL,
	`final_hash` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `godmode_cozy_archive_hash` ON `godmode_cozy_archives` (`save_id`,`final_hash`);--> statement-breakpoint
CREATE TABLE `godmode_cozy_commands` (
	`save_id` text NOT NULL,
	`command_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`revision` integer NOT NULL,
	PRIMARY KEY(`save_id`, `command_id`)
);
--> statement-breakpoint
CREATE TABLE `godmode_cozy_imported_audits` (
	`save_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`payload_json` text NOT NULL,
	PRIMARY KEY(`save_id`, `sequence`)
);
--> statement-breakpoint
CREATE TABLE `godmode_cozy_operations` (
	`save_id` text NOT NULL,
	`revision` integer NOT NULL,
	`kind` text NOT NULL,
	`payload_json` text NOT NULL,
	`state_hash` text NOT NULL,
	`guard` integer NOT NULL,
	PRIMARY KEY(`save_id`, `revision`),
	CONSTRAINT "cozy_operation_guard" CHECK("godmode_cozy_operations"."guard"=1)
);
--> statement-breakpoint
CREATE TABLE `godmode_cozy_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`save_id` text NOT NULL,
	`request_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`kind` text NOT NULL,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`prompt` text,
	`base_rules_revision` integer NOT NULL,
	`caps_hash` text NOT NULL,
	`payload_json` text,
	`preview_json` text,
	`attempt_id` text,
	`error_code` text,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`applied_command_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `godmode_cozy_proposal_request` ON `godmode_cozy_proposals` (`save_id`,`request_id`);--> statement-breakpoint
CREATE TABLE `godmode_cozy_rule_changes` (
	`save_id` text NOT NULL,
	`rules_revision` integer NOT NULL,
	`proposal_id` text,
	`command_id` text NOT NULL,
	`kind` text NOT NULL,
	`step` integer NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text NOT NULL,
	`guard` integer NOT NULL,
	PRIMARY KEY(`save_id`, `rules_revision`),
	CONSTRAINT "cozy_rule_change_guard" CHECK("godmode_cozy_rule_changes"."guard"=1)
);
--> statement-breakpoint
CREATE TABLE `godmode_cozy_saves` (
	`id` text PRIMARY KEY NOT NULL,
	`slot` text,
	`revision` integer DEFAULT 0 NOT NULL,
	`mode` text DEFAULT 'manual' NOT NULL,
	`state_json` text NOT NULL,
	`parent_id` text,
	`created_at` text NOT NULL,
	`paused` integer DEFAULT 1 NOT NULL,
	`pace_milli` integer DEFAULT 1000 NOT NULL,
	`clock_wall_ms` integer NOT NULL,
	`owed_sim_ms` integer DEFAULT 0 NOT NULL,
	`last_tick_at` text,
	`last_background_tick_at` text,
	`lease_token` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`reserved_micro` integer DEFAULT 0 NOT NULL,
	`spent_micro` integer DEFAULT 0 NOT NULL,
	`generation_attempts` integer DEFAULT 0 NOT NULL,
	`http_requests` integer DEFAULT 0 NOT NULL,
	`budget_micro` integer DEFAULT 3000000 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `godmode_cozy_slot` ON `godmode_cozy_saves` (`slot`);--> statement-breakpoint
CREATE TABLE `godmode_cozy_ticks` (
	`id` text NOT NULL,
	`save_id` text NOT NULL,
	`source` text NOT NULL,
	`from_step` integer NOT NULL,
	`to_step` integer NOT NULL,
	`consumed_ms` integer NOT NULL,
	`created_at` text NOT NULL,
	`guard` integer NOT NULL,
	PRIMARY KEY(`save_id`, `id`),
	CONSTRAINT "cozy_tick_guard" CHECK("godmode_cozy_ticks"."guard"=1)
);
--> statement-breakpoint
ALTER TABLE `godmode_jobs` ADD `purpose` text DEFAULT 'resident' NOT NULL;