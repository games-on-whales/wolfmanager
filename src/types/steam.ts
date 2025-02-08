export interface SteamGame {
    appid: number;
    name: string;
    playtime_forever: number;
    rtime_last_played: number;
    img_icon_url: string;
    has_community_visible_stats?: boolean;
    playtime_windows_forever?: number;
    playtime_mac_forever?: number;
    playtime_linux_forever?: number;
    playtime_2weeks?: number;
}

export interface WolfConfig {
    socketPath: string;
} 