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
} 