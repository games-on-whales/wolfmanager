/**
 * Migration Types
 * 
 * TypeScript interfaces for TOML data structures and migration results
 */

// TOML structure interfaces based on the analyzed files

/**
 * Default configuration TOML structure
 */
export interface DefaultConfigToml {
  system: TomlSystemConfig;
  users: Record<string, TomlUser>;
  metadataProviders?: Record<string, TomlMetadataProvider>;
}

export interface TomlSystemConfig {
  name: string;
  version: string;
}

export interface TomlUser {
  id: string;
  username: string;
  password_hash: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
  has_changed_password: boolean;
  steam_id?: string;
  steam_api_key?: string;
  clients?: TomlClientDevice[];
}

export interface TomlClientDevice {
  id: string;
  friendly_name: string;
  pair_secret: string;
}

export interface TomlMetadataProvider {
  enabled: boolean;
  apiKey: string;
}

/**
 * Steam library TOML structure
 */
export interface SteamLibraryToml {
  metadata: TomlPlatformMetadata;
  games: Record<string, TomlGameMaster>;
  user_libraries: Record<string, TomlUserLibrary>;
}

export interface TomlPlatformMetadata {
  platform: string;
  last_sync: string;
  version: string;
}

export interface TomlGameMaster {
  name: string;
  icon_url: string;
  platform_id: string;
  last_updated: string;
}

export interface TomlUserLibrary {
  games: TomlUserGame[];
}

export interface TomlUserGame {
  platform_id: string;
  name: string;
  icon_url: string;
  playtime_total: number;
  playtime_linux: number;
  last_played?: number;
}

/**
 * Tasks configuration TOML structure
 */
export interface TasksConfigToml {
  tasks: TomlTask[];
}

export interface TomlTask {
  id: string;
  name: string;
  description: string;
  schedule: string;
  is_enabled: boolean;
  status: string;
  last_run_at?: string;
  next_run_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Migration result interface
 */
export interface MigrationResult {
  success: boolean;
  usersCreated: number;
  clientDevicesCreated: number;
  platformsCreated: number;
  gamesCreated: number;
  userLibrariesCreated: number;
  userGamesCreated: number;
  tasksCreated: number;
  systemConfigCreated: number;
  metadataProvidersCreated: number;
  errors: string[];
  warnings: string[];
  startTime: string;
  endTime: string;
  duration: number; // milliseconds
}

/**
 * Migration options interface
 */
export interface MigrationOptions {
  dryRun?: boolean;
  force?: boolean;
  backup?: boolean;
  skipErrors?: boolean;
  verbose?: boolean;
}

/**
 * Migration step result interface
 */
export interface MigrationStepResult {
  success: boolean;
  itemsProcessed: number;
  itemsCreated: number;
  itemsSkipped: number;
  errors: string[];
  warnings: string[];
}

/**
 * File validation result interface
 */
export interface FileValidationResult {
  exists: boolean;
  valid: boolean;
  error?: string;
  data?: any;
}

/**
 * Database backup info
 */
export interface BackupInfo {
  filename: string;
  path: string;
  timestamp: string;
  size: number;
}