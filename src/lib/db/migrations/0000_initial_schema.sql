-- Initial database schema migration
-- Creates all tables for WolfUI database
-- Restructured with proper CREATE TABLE -> CREATE INDEX ordering and IF NOT EXISTS clauses

-- First, create all tables with proper foreign key handling
CREATE TABLE IF NOT EXISTS `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`is_admin` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`has_changed_password` integer DEFAULT false NOT NULL,
	`display_name` text,
	`steam_id` text,
	`steam_api_key` text
);

CREATE TABLE IF NOT EXISTS `platforms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`last_sync` text NOT NULL,
	`version` text DEFAULT '1.0.0' NOT NULL
);

CREATE TABLE IF NOT EXISTS `client_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`friendly_name` text NOT NULL,
	`pair_secret` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `games` (
	`id` text PRIMARY KEY NOT NULL,
	`platform_id` text NOT NULL,
	`platform_game_id` text NOT NULL,
	`name` text NOT NULL,
	`icon_url` text DEFAULT '' NOT NULL,
	`last_updated` text NOT NULL,
	FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `user_libraries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`platform_id` text NOT NULL,
	`steam_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `user_games` (
	`id` text PRIMARY KEY NOT NULL,
	`user_library_id` text NOT NULL,
	`game_id` text NOT NULL,
	`playtime_total` integer DEFAULT 0 NOT NULL,
	`playtime_linux` integer DEFAULT 0 NOT NULL,
	`last_played` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_library_id`) REFERENCES `user_libraries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`schedule` text NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'IDLE' NOT NULL,
	`last_run_at` text,
	`next_run_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `system_config` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `metadata_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`api_key` text,
	`config` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);

-- Then, create all indexes (with IF NOT EXISTS to prevent duplicates)
-- Users table indexes
CREATE UNIQUE INDEX IF NOT EXISTS `users_username_idx` ON `users` (`username`);
CREATE INDEX IF NOT EXISTS `users_steam_id_idx` ON `users` (`steam_id`);

-- Client devices table indexes
CREATE INDEX IF NOT EXISTS `client_devices_user_id_idx` ON `client_devices` (`user_id`);
CREATE INDEX IF NOT EXISTS `client_devices_pair_secret_idx` ON `client_devices` (`pair_secret`);

-- Platforms table indexes
CREATE INDEX IF NOT EXISTS `platforms_name_idx` ON `platforms` (`name`);

-- Games table indexes
CREATE UNIQUE INDEX IF NOT EXISTS `games_platform_game_idx` ON `games` (`platform_id`,`platform_game_id`);
CREATE INDEX IF NOT EXISTS `games_name_idx` ON `games` (`name`);
CREATE INDEX IF NOT EXISTS `games_platform_idx` ON `games` (`platform_id`);

-- User libraries table indexes
CREATE UNIQUE INDEX IF NOT EXISTS `user_libraries_user_platform_idx` ON `user_libraries` (`user_id`,`platform_id`);
CREATE INDEX IF NOT EXISTS `user_libraries_user_idx` ON `user_libraries` (`user_id`);
CREATE INDEX IF NOT EXISTS `user_libraries_platform_idx` ON `user_libraries` (`platform_id`);

-- User games table indexes
CREATE UNIQUE INDEX IF NOT EXISTS `user_games_library_game_idx` ON `user_games` (`user_library_id`,`game_id`);
CREATE INDEX IF NOT EXISTS `user_games_library_idx` ON `user_games` (`user_library_id`);
CREATE INDEX IF NOT EXISTS `user_games_game_idx` ON `user_games` (`game_id`);
CREATE INDEX IF NOT EXISTS `user_games_last_played_idx` ON `user_games` (`last_played`);

-- Tasks table indexes
CREATE UNIQUE INDEX IF NOT EXISTS `tasks_name_idx` ON `tasks` (`name`);
CREATE INDEX IF NOT EXISTS `tasks_status_idx` ON `tasks` (`status`);
CREATE INDEX IF NOT EXISTS `tasks_enabled_idx` ON `tasks` (`is_enabled`);
CREATE INDEX IF NOT EXISTS `tasks_next_run_idx` ON `tasks` (`next_run_at`);

-- System config table indexes
CREATE UNIQUE INDEX IF NOT EXISTS `system_config_key_idx` ON `system_config` (`key`);

-- Metadata providers table indexes
CREATE UNIQUE INDEX IF NOT EXISTS `metadata_providers_name_idx` ON `metadata_providers` (`name`);
CREATE INDEX IF NOT EXISTS `metadata_providers_enabled_idx` ON `metadata_providers` (`enabled`);