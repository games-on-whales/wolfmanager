"use client";

import { LogComponent, LogEntry } from "./types";

/**
 * Client-side logger wrapper that ensures proper error boundary integration
 * and loading state handling in Next.js client components.
 */
class ClientLogger {
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
    try {
      const response = await fetch("/api/log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(entry),
      });

      if (!response.ok) {
        throw new Error(`Failed to log: ${response.statusText}`);
      }
    } catch (error) {
      // Store failed logs in localStorage for retry
      const failedLogs = JSON.parse(
        localStorage.getItem("failed_logs") || "[]"
      );
      failedLogs.push(entry);
      localStorage.setItem("failed_logs", JSON.stringify(failedLogs));
      throw error;
    }
  }

  public debug(
    component: LogComponent,
    message: string,
    raw?: unknown,
    metadata?: Record<string, unknown>
  ): void {
    const promise = this.logToServer({
      timestamp: new Date(),
      level: "debug",
      component,
      message,
      raw,
      metadata,
    });
    this.queue.push(promise);
    this.processQueue();
  }

  public info(
    component: LogComponent,
    message: string,
    raw?: unknown,
    metadata?: Record<string, unknown>
  ): void {
    const promise = this.logToServer({
      timestamp: new Date(),
      level: "info",
      component,
      message,
      raw,
      metadata,
    });
    this.queue.push(promise);
    this.processQueue();
  }

  public warn(
    component: LogComponent,
    message: string,
    raw?: unknown,
    metadata?: Record<string, unknown>
  ): void {
    const promise = this.logToServer({
      timestamp: new Date(),
      level: "warn",
      component,
      message,
      raw,
      metadata,
    });
    this.queue.push(promise);
    this.processQueue();
  }

  public error(
    component: LogComponent,
    message: string,
    raw?: unknown,
    metadata?: Record<string, unknown>
  ): void {
    const promise = this.logToServer({
      timestamp: new Date(),
      level: "error",
      component,
      message,
      raw,
      metadata,
    });
    this.queue.push(promise);
    this.processQueue();
  }
}

export const clientLogger = ClientLogger.getInstance();
