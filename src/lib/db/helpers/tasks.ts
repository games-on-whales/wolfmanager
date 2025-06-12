import { eq } from 'drizzle-orm';
import { getDatabase } from '../index';
import { databaseConfig } from '../config';
import { logger } from '../../logger';
import { LogComponent } from '../../logger/types';
import {
  tasksSqlite,
  tasksPostgres,
  tasksMysql,
  type Task,
  type TaskStatus,
  type NewTask,
  type TaskUpdate,
  type TaskExecutionResult,
} from '../schema/tasks';

/**
 * Get the appropriate tasks table based on database type
 */
function getTasksTable() {
  switch (databaseConfig.type) {
    case 'sqlite':
      return tasksSqlite;
    case 'postgresql':
      return tasksPostgres;
    case 'mysql':
      return tasksMysql;
    default:
      throw new Error(`Unsupported database type: ${databaseConfig.type}`);
  }
}

/**
 * Get task by ID
 */
export async function getTaskById(id: string): Promise<Task | null> {
  try {
    const db = await getDatabase();
    const tasksTable = getTasksTable();
    
    const [task] = await (db as any)
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.id, id))
      .limit(1);
    
    return task || null;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get task by ID', error as Error, { taskId: id });
    throw new Error('Failed to retrieve task');
  }
}

/**
 * Get task by name
 */
export async function getTaskByName(name: string): Promise<Task | null> {
  try {
    const db = await getDatabase();
    const tasksTable = getTasksTable();
    
    const [task] = await (db as any)
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.name, name))
      .limit(1);
    
    return task || null;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get task by name', error as Error, { name });
    throw new Error('Failed to retrieve task');
  }
}

/**
 * Get all tasks
 */
export async function getAllTasks(): Promise<Task[]> {
  try {
    const db = await getDatabase();
    const tasksTable = getTasksTable();
    
    const tasks = await (db as any).select().from(tasksTable);
    
    return tasks;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get all tasks', error as Error);
    throw new Error('Failed to retrieve tasks');
  }
}

/**
 * Get enabled tasks
 */
export async function getEnabledTasks(): Promise<Task[]> {
  try {
    const db = await getDatabase();
    const tasksTable = getTasksTable();
    
    const tasks = await (db as any)
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.isEnabled, true));
    
    return tasks;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get enabled tasks', error as Error);
    throw new Error('Failed to retrieve enabled tasks');
  }
}

/**
 * Get tasks by status
 */
export async function getTasksByStatus(status: TaskStatus): Promise<Task[]> {
  try {
    const db = await getDatabase();
    const tasksTable = getTasksTable();
    
    const tasks = await (db as any)
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.status, status));
    
    return tasks;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get tasks by status', error as Error, { status });
    throw new Error('Failed to retrieve tasks');
  }
}

/**
 * Add a new task
 */
export async function addTask(taskData: NewTask): Promise<Task> {
  try {
    const db = await getDatabase();
    const tasksTable = getTasksTable();
    
    // Validate required fields
    if (!taskData.name || !taskData.description || !taskData.schedule) {
      throw new Error('Name, description, and schedule are required');
    }
    
    // Check if task name already exists
    const existingTask = await getTaskByName(taskData.name);
    if (existingTask) {
      throw new Error('Task name already exists');
    }
    
    const newTask: Task = {
      id: crypto.randomUUID(),
      ...taskData,
      status: 'IDLE' as TaskStatus,
      lastRunAt: null,
      nextRunAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await (db as any).insert(tasksTable).values(newTask);
    
    logger.info(LogComponent.SYSTEM, 'Task created successfully', { 
      taskId: newTask.id, 
      name: newTask.name 
    });
    
    return newTask;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to add task', error as Error, { name: taskData.name });
    throw error;
  }
}

/**
 * Update task
 */
export async function updateTask(id: string, updates: TaskUpdate): Promise<Task> {
  try {
    const db = await getDatabase();
    const tasksTable = getTasksTable();
    
    // Check if task exists
    const existingTask = await getTaskById(id);
    if (!existingTask) {
      throw new Error('Task not found');
    }
    
    // Note: TaskUpdate excludes name field, so name cannot be updated
    // This is by design as task names should be immutable after creation
    
    const updatedData = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    await (db as any)
      .update(tasksTable)
      .set(updatedData)
      .where(eq(tasksTable.id, id));
    
    const updatedTask = await getTaskById(id);
    if (!updatedTask) {
      throw new Error('Failed to retrieve updated task');
    }
    
    logger.info(LogComponent.SYSTEM, 'Task updated successfully', { taskId: id });
    
    return updatedTask;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to update task', error as Error, { taskId: id });
    throw error;
  }
}

/**
 * Delete task
 */
export async function deleteTask(id: string): Promise<void> {
  try {
    const db = await getDatabase();
    const tasksTable = getTasksTable();
    
    // Check if task exists
    const existingTask = await getTaskById(id);
    if (!existingTask) {
      throw new Error('Task not found');
    }
    
    await (db as any).delete(tasksTable).where(eq(tasksTable.id, id));
    
    logger.info(LogComponent.SYSTEM, 'Task deleted successfully', { taskId: id });
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to delete task', error as Error, { taskId: id });
    throw error;
  }
}

/**
 * Update task status
 */
export async function updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  try {
    const db = await getDatabase();
    const tasksTable = getTasksTable();
    
    // Check if task exists
    const existingTask = await getTaskById(id);
    if (!existingTask) {
      throw new Error('Task not found');
    }
    
    const updatedData = {
      status,
      updatedAt: new Date().toISOString(),
    };
    
    await (db as any)
      .update(tasksTable)
      .set(updatedData)
      .where(eq(tasksTable.id, id));
    
    const updatedTask = await getTaskById(id);
    if (!updatedTask) {
      throw new Error('Failed to retrieve updated task');
    }
    
    logger.info(LogComponent.SYSTEM, 'Task status updated successfully', { 
      taskId: id, 
      status 
    });
    
    return updatedTask;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to update task status', error as Error, { 
      taskId: id, 
      status 
    });
    throw error;
  }
}

/**
 * Update task execution result
 */
export async function updateTaskExecution(id: string, result: TaskExecutionResult): Promise<Task> {
  try {
    const db = await getDatabase();
    const tasksTable = getTasksTable();
    
    // Check if task exists
    const existingTask = await getTaskById(id);
    if (!existingTask) {
      throw new Error('Task not found');
    }
    
    const now = new Date().toISOString();
    const updatedData = {
      status: result.success ? ('IDLE' as TaskStatus) : ('ERROR' as TaskStatus),
      lastRunAt: now,
      updatedAt: now,
    };
    
    await (db as any)
      .update(tasksTable)
      .set(updatedData)
      .where(eq(tasksTable.id, id));
    
    const updatedTask = await getTaskById(id);
    if (!updatedTask) {
      throw new Error('Failed to retrieve updated task');
    }
    
    logger.info(LogComponent.SYSTEM, 'Task execution updated successfully', { 
      taskId: id, 
      success: result.success,
      duration: result.duration 
    });
    
    return updatedTask;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to update task execution', error as Error, { 
      taskId: id 
    });
    throw error;
  }
}