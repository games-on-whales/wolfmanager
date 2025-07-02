CREATE TABLE `client_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`wolf_client_id` text NOT NULL,
	`user_id` text NOT NULL,
	`friendly_name` text NOT NULL,
	`pair_secret` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_seen` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `client_devices_user_id_idx` ON `client_devices` (`user_id`);--> statement-breakpoint
CREATE INDEX `client_devices_pair_secret_idx` ON `client_devices` (`pair_secret`);--> statement-breakpoint
CREATE INDEX `client_devices_wolf_client_id_idx` ON `client_devices` (`wolf_client_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `client_devices_user_id_wolf_client_id_unique_idx` ON `client_devices` (`user_id`,`wolf_client_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `client_devices_user_id_pair_secret_unique_idx` ON `client_devices` (`user_id`,`pair_secret`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`platform_id` text NOT NULL,
	`platform_game_id` text NOT NULL,
	`name` text NOT NULL,
	`icon_url` text DEFAULT '' NOT NULL,
	`last_updated` text NOT NULL,
	FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `games_platform_game_idx` ON `games` (`platform_id`,`platform_game_id`);--> statement-breakpoint
CREATE INDEX `games_name_idx` ON `games` (`name`);--> statement-breakpoint
CREATE INDEX `games_platform_idx` ON `games` (`platform_id`);--> statement-breakpoint
CREATE TABLE `platforms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`last_sync` text NOT NULL,
	`version` text DEFAULT '1.0.0' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `platforms_name_idx` ON `platforms` (`name`);--> statement-breakpoint
CREATE TABLE `user_games` (
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
--> statement-breakpoint
CREATE UNIQUE INDEX `user_games_library_game_idx` ON `user_games` (`user_library_id`,`game_id`);--> statement-breakpoint
CREATE INDEX `user_games_library_idx` ON `user_games` (`user_library_id`);--> statement-breakpoint
CREATE INDEX `user_games_game_idx` ON `user_games` (`game_id`);--> statement-breakpoint
CREATE INDEX `user_games_last_played_idx` ON `user_games` (`last_played`);--> statement-breakpoint
CREATE TABLE `user_libraries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`platform_id` text NOT NULL,
	`steam_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_libraries_user_platform_idx` ON `user_libraries` (`user_id`,`platform_id`);--> statement-breakpoint
CREATE INDEX `user_libraries_user_idx` ON `user_libraries` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_libraries_platform_idx` ON `user_libraries` (`platform_id`);--> statement-breakpoint
CREATE TABLE `metadata_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`api_key` text,
	`config` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `metadata_providers_name_unique` ON `metadata_providers` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `metadata_providers_name_idx` ON `metadata_providers` (`name`);--> statement-breakpoint
CREATE INDEX `metadata_providers_enabled_idx` ON `metadata_providers` (`enabled`);--> statement-breakpoint
CREATE TABLE `system_config` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `system_config_key_unique` ON `system_config` (`key`);--> statement-breakpoint
CREATE UNIQUE INDEX `system_config_key_idx` ON `system_config` (`key`);--> statement-breakpoint
CREATE TABLE `tasks` (
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
--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_name_unique` ON `tasks` (`name`);--> statement-breakpoint
CREATE INDEX `tasks_name_idx` ON `tasks` (`name`);--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `tasks_enabled_idx` ON `tasks` (`is_enabled`);--> statement-breakpoint
CREATE INDEX `tasks_next_run_idx` ON `tasks` (`next_run_at`);--> statement-breakpoint
CREATE TABLE `users` (
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
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_idx` ON `users` (`username`);--> statement-breakpoint
CREATE INDEX `users_steam_id_idx` ON `users` (`steam_id`);