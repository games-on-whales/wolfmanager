import { Task, TaskStatus, TaskSubscriber } from './types';
import Logger from '../logs';
import SteamService from '../steam';

class TaskService {
  private tasks: Task[] = [];
  private subscribers: TaskSubscriber[] = [];
  private gamesListTaskId: string;
  private artworkTaskId: string;
  private clearCacheTaskId: string;

  constructor() {
    // Create the persistent tasks
    this.gamesListTaskId = crypto.randomUUID();
    this.artworkTaskId = crypto.randomUUID();
    this.clearCacheTaskId = crypto.randomUUID();

    this.tasks = [
      {
        id: this.gamesListTaskId,
        name: 'Refresh Games List',
        status: TaskStatus.COMPLETED,
        progress: 0,
        message: 'Idle',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString()
      },
      {
        id: this.artworkTaskId,
        name: 'Refresh Game Artwork',
        status: TaskStatus.COMPLETED,
        progress: 0,
        message: 'Idle',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString()
      },
      {
        id: this.clearCacheTaskId,
        name: 'Clear Artwork Cache',
        status: TaskStatus.COMPLETED,
        progress: 0,
        message: 'Idle',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString()
      }
    ];
  }

  subscribe(subscriber: TaskSubscriber): () => void {
    this.subscribers.push(subscriber);
    subscriber(this.tasks);
    return () => {
      const index = this.subscribers.indexOf(subscriber);
      if (index !== -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(subscriber => subscriber(this.tasks));
  }

  private updateTask(
    taskId: string,
    update: Partial<Pick<Task, 'status' | 'progress' | 'message' | 'error'>>
  ): void {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) {
      Logger.warn('Task not found', 'TaskService', { taskId });
      return;
    }

    Object.assign(task, update);

    if (update.status === TaskStatus.COMPLETED || update.status === TaskStatus.FAILED) {
      task.endTime = new Date().toISOString();
    } else if (update.status === TaskStatus.RUNNING) {
      task.startTime = new Date().toISOString();
      task.endTime = undefined;
    }

    this.notifySubscribers();
    Logger.debug('Task updated', 'TaskService', { taskId, update });
  }

  getTasks(): Task[] {
    return this.tasks;
  }

  async refreshGameArtwork(): Promise<void> {
    try {
      this.updateTask(this.artworkTaskId, {
        status: TaskStatus.RUNNING,
        message: 'Starting artwork refresh...',
        progress: 0
      });

      await SteamService.refreshAllArtwork();
      
      this.updateTask(this.artworkTaskId, {
        status: TaskStatus.COMPLETED,
        message: 'Artwork refresh completed',
        progress: 100
      });
    } catch (error) {
      this.updateTask(this.artworkTaskId, {
        status: TaskStatus.FAILED,
        error: error instanceof Error ? error : new Error('Unknown error'),
        message: 'Failed to refresh artwork'
      });
      throw error;
    }
  }

  async refreshGamesList(): Promise<void> {
    try {
      this.updateTask(this.gamesListTaskId, {
        status: TaskStatus.RUNNING,
        message: 'Fetching games list...',
        progress: 0
      });

      await SteamService.getOwnedGames();
      
      this.updateTask(this.gamesListTaskId, {
        status: TaskStatus.COMPLETED,
        message: 'Games list updated',
        progress: 100
      });
    } catch (error) {
      this.updateTask(this.gamesListTaskId, {
        status: TaskStatus.FAILED,
        error: error instanceof Error ? error : new Error('Unknown error'),
        message: 'Failed to refresh games list'
      });
      throw error;
    }
  }

  async clearArtworkCache(): Promise<void> {
    try {
      this.updateTask(this.clearCacheTaskId, {
        status: TaskStatus.RUNNING,
        message: 'Clearing artwork cache...',
        progress: 0
      });

      const response = await fetch('/api/cache/artwork/clear', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to clear artwork cache');
      }
      
      this.updateTask(this.clearCacheTaskId, {
        status: TaskStatus.COMPLETED,
        message: 'Artwork cache cleared',
        progress: 100
      });
    } catch (error) {
      this.updateTask(this.clearCacheTaskId, {
        status: TaskStatus.FAILED,
        error: error instanceof Error ? error : new Error('Unknown error'),
        message: 'Failed to clear artwork cache'
      });
      throw error;
    }
  }
}

export default new TaskService(); 