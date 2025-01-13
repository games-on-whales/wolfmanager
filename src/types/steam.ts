export interface SteamGame {
    appid: number;
    name: string;
    installed: boolean;
    installing?: boolean;
}

export interface WolfConfig {
    socketPath: string;
} 