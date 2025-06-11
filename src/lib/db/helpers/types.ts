/**
 * Additional types for database helper functions
 */

import type { Game, Platform, UserLibrary } from '../schema';

/**
 * User game with details (joined data)
 */
export interface UserGameWithDetails {
  userGame: {
    id: string;
    userLibraryId: string;
    gameId: string;
    playtimeTotal: number;
    playtimeLinux: number;
    lastPlayed?: number | null;
    createdAt: string;
    updatedAt: string;
  };
  game: Game;
  platform: Platform;
  userLibrary: UserLibrary;
}

/**
 * Paginated results
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Search options
 */
export interface SearchOptions {
  query?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Database operation result
 */
export interface DatabaseResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Transaction callback type
 */
export type TransactionCallback<T> = () => Promise<T>;

/**
 * Database statistics
 */
export interface DatabaseStats {
  users: number;
  games: number;
  platforms: number;
  userGames: number;
  tasks: number;
  clientDevices: number;
}