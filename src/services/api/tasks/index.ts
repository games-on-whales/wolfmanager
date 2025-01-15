import { Task, TaskStatus, TaskSubscriber } from './types';
import Logger from '../logs';

class TaskService {
  private tasks: Task[] = [];
  private subscribers: TaskSubscriber[] = [];

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

  private cleanupOldTasks(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.tasks = this.tasks.filter(task => {
      if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) {
        const endTime = task.endTime ? new Date(task.endTime) : new Date();
        return endTime > oneHourAgo;
      }
      return true;
    });
  }

  createTask(name: string): Task {
    const task: Task = {
      id: crypto.randomUUID(),
      name,
      status: TaskStatus.PENDING,
      progress: 0,
      startTime: new Date().toISOString()
    };

    this.tasks.push(task);
    this.cleanupOldTasks();
    this.notifySubscribers();
    Logger.debug('Task created', 'TaskService', task);

    return task;
  }

  updateTask(
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
    }

    this.notifySubscribers();
    Logger.debug('Task updated', 'TaskService', { taskId, update });
  }

  removeTask(taskId: string): void {
    const index = this.tasks.findIndex(t => t.id === taskId);
    if (index !== -1) {
      this.tasks.splice(index, 1);
      this.notifySubscribers();
      Logger.debug('Task removed', 'TaskService', { taskId });
    }
  }

  getTasks(): Task[] {
    this.cleanupOldTasks();
    return this.tasks;
  }
}

export default new TaskService(); 