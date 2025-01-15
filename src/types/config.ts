export interface UserConfig {
  steamId: string;
  steamApiKey: string;
}

export interface AdminConfig {
  libraryPath: string;
  usersPath: string;
  steamGridDbApiKey: string;
  users: Record<string, UserConfig>;
}

export interface Config extends AdminConfig {
  currentUser?: string;
}

export interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url: string;
  img_logo_url: string;
  rtime_last_played: number;
  has_community_visible_stats?: boolean;
  playtime_windows_forever?: number;
  playtime_mac_forever?: number;
  playtime_linux_forever?: number;
  playtime_deck_forever?: number;
  content_descriptorids?: number[];
  playtime_disconnected?: number;
} 