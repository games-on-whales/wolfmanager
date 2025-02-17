export interface UserConfig {
  steamId?: string;
  steamApiKey?: string;
  clients?: Record<string, { // client_id as key
    friendlyName: string;
  }>;
}

export interface DockerRepository {
  name: string;
  repository: string;
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