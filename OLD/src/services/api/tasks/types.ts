export enum TaskStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface Task {
  id: string;
  name: string;
  status: TaskStatus;
  progress: number;
  message?: string;
  error?: Error;
  startTime: string;
  endTime?: string;
}

export type TaskSubscriber = (tasks: Task[]) => void; 