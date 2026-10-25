CREATE TABLE `godmode_cozy_initiatives` (
	`id` text PRIMARY KEY NOT NULL,
	`save_id` text NOT NULL,
	`request_id` text NOT NULL,
	`trigger_key` text NOT NULL,
	`npc_id` text NOT NULL,
	`snapshot_step` integer NOT NULL,
	`rules_revision` integer NOT NULL,
	`intent_hash` text NOT NULL,
	`context_hash` text NOT NULL,
	`context_json` text NOT NULL,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`job_id` text,
	`decision_json` text,
	`summary` text,
	`error_code` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `godmode_cozy_initiative_request` ON `godmode_cozy_initiatives` (`save_id`,`request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `godmode_cozy_initiative_trigger` ON `godmode_cozy_initiatives` (`save_id`,`trigger_key`);--> statement-breakpoint
CREATE INDEX `godmode_cozy_initiative_recent` ON `godmode_cozy_initiatives` (`save_id`,`created_at`);--> statement-breakpoint
CREATE TRIGGER `godmode_cozy_initiative_snapshot_immutable`
BEFORE UPDATE OF id,save_id,request_id,trigger_key,npc_id,snapshot_step,rules_revision,intent_hash,context_hash,context_json,source,created_at
ON godmode_cozy_initiatives
BEGIN
 SELECT RAISE(ABORT,'initiative snapshot is immutable');
END;
