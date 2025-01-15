import Logger from './LogService';

export interface Task {
  id: string;
  name: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  error?: string;
  startTime: Date;
  endTime?: Date;
}

type TaskSubscriber = (tasks: Task[]) => void;

class TaskServiceClass {
  private tasks: Task[] = [];
  private subscribers: TaskSubscriber[] = [];
  private static instance: TaskServiceClass;

  private constructor() {}

  static getInstance(): TaskServiceClass {
    if (!TaskServiceClass.instance) {
      TaskServiceClass.instance = new TaskServiceClass();
    }
    return TaskServiceClass.instance;
  }

  subscribe(callback: TaskSubscriber) {
    this.subscribers.push(callback);
    callback([...this.tasks]);

    return {
      unsubscribe: () => {
        this.subscribers = this.subscribers.filter(cb => cb !== callback);
      }
    };
  }

  private notifySubscribers() {
    this.subscribers.forEach(callback => callback([...this.tasks]));
  }

  createTask(name: string): Task {
    const task: Task = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      status: 'queued',
      startTime: new Date()
    };

    this.tasks.push(task);
    this.notifySubscribers();
    return task;
  }

  updateTask(id: string, updates: Partial<Task>) {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      Object.assign(task, updates);
      if (updates.status === 'completed' || updates.status === 'failed') {
        task.endTime = new Date();
      }
      this.notifySubscribers();
    }
  }

  removeTask(id: string) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.notifySubscribers();
  }

  // Clean up completed tasks older than 1 hour
  cleanupTasks() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.tasks = this.tasks.filter(task => {
      if (task.status === 'completed' || task.status === 'failed') {
        return task.endTime && task.endTime > oneHourAgo;
      }
      return true;
    });
    this.notifySubscribers();
  }
}

export const TaskService = TaskServiceClass.getInstance(); 