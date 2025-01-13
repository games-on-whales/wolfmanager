export interface Config {
  steamId: string;
  libraryPath: string;
  steamApiKey: string;
  steamGridDbApiKey: string;
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