export const SCHEMA_SQL=`
CREATE TABLE IF NOT EXISTS godmode_runs (
 id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, mode TEXT NOT NULL,
 state_json TEXT NOT NULL,parent_id TEXT,created_at TEXT NOT NULL,
 lease_token TEXT,lease_until INTEGER NOT NULL DEFAULT 0,
 reserved_micro INTEGER NOT NULL DEFAULT 0,spent_micro INTEGER NOT NULL DEFAULT 0,
 generation_attempts INTEGER NOT NULL DEFAULT 0,http_requests INTEGER NOT NULL DEFAULT 0,
 event_admitted INTEGER NOT NULL DEFAULT 0,budget_micro INTEGER NOT NULL DEFAULT 3000000
);
CREATE TABLE IF NOT EXISTS godmode_operations (
 run_id TEXT NOT NULL,revision INTEGER NOT NULL,kind TEXT NOT NULL,payload_json TEXT NOT NULL,
 state_hash TEXT NOT NULL,guard INTEGER NOT NULL CHECK(guard=1),PRIMARY KEY(run_id,revision)
);
CREATE TABLE IF NOT EXISTS godmode_commands (run_id TEXT NOT NULL,command_id TEXT NOT NULL,revision INTEGER NOT NULL,PRIMARY KEY(run_id,command_id));
CREATE TABLE IF NOT EXISTS godmode_jobs (
 id TEXT PRIMARY KEY,run_id TEXT NOT NULL,ticket_id TEXT NOT NULL,status TEXT NOT NULL,
 reserved_micro INTEGER NOT NULL,actual_micro INTEGER,result_json TEXT,error_code TEXT,
 dispatched_at INTEGER,created_at INTEGER NOT NULL,guard INTEGER NOT NULL CHECK(guard=1),UNIQUE(run_id,ticket_id)
);
CREATE TABLE IF NOT EXISTS godmode_requests(job_id TEXT NOT NULL,kind TEXT NOT NULL,guard INTEGER NOT NULL CHECK(guard=1),PRIMARY KEY(job_id,kind));
CREATE TABLE IF NOT EXISTS godmode_receipts(job_id TEXT PRIMARY KEY,guard INTEGER NOT NULL CHECK(guard=1));
CREATE INDEX IF NOT EXISTS godmode_jobs_run ON godmode_jobs(run_id,status);
CREATE TABLE IF NOT EXISTS godmode_project_budget(id TEXT PRIMARY KEY,limit_micro INTEGER NOT NULL,reserved_micro INTEGER NOT NULL DEFAULT 0,spent_micro INTEGER NOT NULL DEFAULT 0,generation_attempts INTEGER NOT NULL DEFAULT 0,http_requests INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS godmode_imported_audits(run_id TEXT NOT NULL,sequence INTEGER NOT NULL,payload_json TEXT NOT NULL,PRIMARY KEY(run_id,sequence));
CREATE TABLE IF NOT EXISTS godmode_worlds(id TEXT PRIMARY KEY,run_id TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,paused INTEGER NOT NULL DEFAULT 0,pace_milli INTEGER NOT NULL DEFAULT 100,last_wall_ms INTEGER NOT NULL,owed_sim_ms INTEGER NOT NULL DEFAULT 0,lease_token TEXT,lease_until INTEGER NOT NULL DEFAULT 0,pending_job_id TEXT,last_tick_at TEXT,last_background_tick_at TEXT,last_error TEXT,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS godmode_world_tick_jobs(id TEXT PRIMARY KEY,world_id TEXT NOT NULL,run_id TEXT NOT NULL,expected_revision INTEGER NOT NULL,tick_before INTEGER NOT NULL,requested_seconds INTEGER NOT NULL,actual_seconds INTEGER,status TEXT NOT NULL,source TEXT NOT NULL,started_at TEXT NOT NULL,completed_at TEXT,error_code TEXT,guard INTEGER NOT NULL CHECK(guard=1));
CREATE INDEX IF NOT EXISTS godmode_world_ticks_recent ON godmode_world_tick_jobs(world_id,started_at);
CREATE TABLE IF NOT EXISTS godmode_world_archives(id TEXT PRIMARY KEY,run_id TEXT NOT NULL,from_tick INTEGER NOT NULL,to_tick INTEGER NOT NULL,final_hash TEXT NOT NULL,payload_json TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS godmode_archive_hash ON godmode_world_archives(run_id,final_hash);
`;
