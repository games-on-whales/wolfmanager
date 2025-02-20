export interface WolfGame {
  id: string;
  name: string;
  path: string;
  lastPlayed?: string;
  playtime?: number;
  artwork?: string;
}

export interface WolfGameUpdate {
  name?: string;
  path?: string;
  lastPlayed?: string;
  playtime?: number;
  artwork?: string;
} 