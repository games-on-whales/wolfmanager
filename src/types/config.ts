export interface UserConfig {
  steamId?: string;
  steamApiKey?: string;
  clients?: Record<string, {
    friendlyName: string;
  }>;
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
  wolfRepositories: DockerRepository[];
}

export interface DockerRepository {
  name: string;
  repository: string;
}

export interface SteamGame {
  appid: number;
  name: string;
  img_icon_url: string;
  playtime_forever: number;
  playtime_windows_forever: number;
  playtime_mac_forever: number;
  playtime_linux_forever: number;
  has_community_visible_stats?: boolean;
  playtime_disconnected?: number;
} 