"use client";

import { createLogEntry } from "@/lib/actions/logging";
import { LogComponent, LogEntry } from "./types";

/**
 * Client-side logger wrapper that ensures proper error boundary integration
 * and loading state handling in Next.js client components.
 */
export class ClientLogger {
  private static instance: ClientLogger;
  private queue: Promise<void>[] = [];
  private processingQueue = false;

  private constructor() {
    // Initialize queue processing
    this.processQueue();
  }

  public static getInstance(): ClientLogger {
    if (!ClientLogger.instance) {
      ClientLogger.instance = new ClientLogger();
    }
    return ClientLogger.instance;
  }

  private async processQueue() {
    if (this.processingQueue) return;
    this.processingQueue = true;

    while (this.queue.length > 0) {
      const promise = this.queue.shift();
      if (promise) {
        try {
          await promise;
        } catch (error) {
          console.error("Failed to process log entry:", error);
        }
      }
    }

    this.processingQueue = false;
  }

  private async logToServer(entry: LogEntry): Promise<void> {
    const result = await createLogEntry(entry);
    if (!result.success) {
      console.error("Failed to log entry:", result.error);
    }
  }

  public async debug(
    component: LogComponent,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const promise = this.logToServer({
      timestamp: new Date(),
      level: "debug",
      component,
      message,
      metadata,
    });
    this.queue.push(promise);
    await this.processQueue();
  }

  public async info(
    component: LogComponent,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const promise = this.logToServer({
      timestamp: new Date(),
      level: "info",
      component,
      message,
      metadata,
    });
    this.queue.push(promise);
    await this.processQueue();
  }

  public async warn(
    component: LogComponent,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const promise = this.logToServer({
      timestamp: new Date(),
      level: "warn",
      component,
      message,
      metadata,
    });
    this.queue.push(promise);
    await this.processQueue();
  }

  public async error(
    component: LogComponent,
    message: string,
    error: Error,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    // Serialize Error object to make it serializable for server actions
    const serializedError = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
    
    const promise = this.logToServer({
      timestamp: new Date(),
      level: "error",
      component,
      message,
      raw: serializedError,
      metadata,
    });
    this.queue.push(promise);
    await this.processQueue();
  }
}

// Export the singleton instance
export const clientLogger = ClientLogger.getInstance();
