export interface UserConfig {
  steamId: string;
  steamApiKey: string;
}

export interface AdminConfig {
  libraryPath: string;
  usersPath: string;
  cachePath: string;
  steamGridDbApiKey: string;
  debugEnabled: boolean;
  users: Record<string, UserConfig>;
}

export interface Config extends AdminConfig {
  currentUser?: string;
} 