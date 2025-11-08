'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/** Single Server-Sent Event delivered by the Wolf relay. */
export interface WolfRelayEvent {
  /** SSE id (from server) if provided. */
  id?: string;
  /** SSE event type name (custom named events; usually undefined for default "message"). */
  event?: string;
  /** Parsed data payload (JSON if possible, otherwise raw string). */
  data: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  /** Timestamp (ms since epoch) when received by client. */
  receivedAt: number;
}

/** Options for useWolfEvents hook. */
export interface UseWolfEventsOptions {
  /** Callback invoked for each received event after parsing. */
  onEvent?(evt: WolfRelayEvent): void;
  /**
   * Milliseconds with no successful open or event activity before status enters 'reconnecting'.
   * Default: 30000
   */
  reconnectNoticeMs?: number;
}

/** Result returned by useWolfEvents hook. */
export interface UseWolfEventsResult {
  /** Current connection status. */
  status: 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';
  /** Last seen SSE id (if any). */
  lastEventId?: string;
  /** Manually terminate the connection (idempotent). */
  disconnect(): void;
}

/**
 * Parse raw SSE data. Attempts JSON.parse if it appears to be JSON (starts with { or [).
 * Returns the original string on failure.
 */
function parseEventData(raw: string): any { // eslint-disable-line @typescript-eslint/no-explicit-any
  const first = raw?.trim()?.[0];
  if (first === '{' || first === '[') {
    try {
      return JSON.parse(raw);
    } catch {
      // fall through to return raw
    }
  }
  return raw;
}

/**
 * React hook to consume Server-Sent Events from the Wolf relay stream.
 *
 * Behavior:
 * - Safe on SSR (no EventSource usage until client effect).
 * - Automatically transitions statuses based on connection & activity.
 * - Provides typed callback for events.
 *
 * Status transitions:
 *   idle -> connecting (first client render)
 *   connecting -> open (onopen)
 *   open -> reconnecting (inactivity beyond reconnectNoticeMs)
 *   reconnecting -> open (onopen after inactivity)
 *   * -> closed (disconnect/unmount)
 */
export function useWolfEvents(options?: UseWolfEventsOptions): UseWolfEventsResult {
  const { onEvent, reconnectNoticeMs = 30000 } = options || {};

  // Local state
  const [status, setStatus] = useState<UseWolfEventsResult['status']>('idle');
  const [lastEventId, setLastEventId] = useState<string | undefined>(undefined);

  // Refs
  const esRef = useRef<EventSource | null>(null);
  const activityRef = useRef<number>(0);
  const closedRef = useRef<boolean>(false);
  const counterRef = useRef<number>(0); // fallback id counter
  const intervalRef = useRef<number | null>(null);
  const statusRef = useRef(status);

  const disconnect = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    if (intervalRef.current != null) {
      if (typeof window !== 'undefined') {
        window.clearInterval(intervalRef.current);
      }
      intervalRef.current = null;
    }
    if (esRef.current) {
      try {
        esRef.current.close();
      } catch {
        // ignore
      } finally {
        esRef.current = null;
      }
    }
    setStatus('closed');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    // Initialize only once
    if (esRef.current || closedRef.current) {
      return;
    }
    setStatus('connecting');

    const es = new EventSource('/api/events/stream', { withCredentials: true });
    esRef.current = es;
    activityRef.current = Date.now();

    if (process.env.NODE_ENV !== 'production') {
      // minimal debug
      // eslint-disable-next-line no-console
      console.debug('[useWolfEvents] connecting to /api/events/stream');
    }

    es.onopen = () => {
      activityRef.current = Date.now();
      if (closedRef.current) return;
      setStatus(prev => (prev === 'closed' ? 'closed' : 'open'));
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.debug('[useWolfEvents] open');
      }
    };

    es.onmessage = (evt: MessageEvent) => {
      activityRef.current = Date.now();
      const parsed = parseEventData(String(evt.data ?? ''));
      const id = (evt.lastEventId && evt.lastEventId.length > 0)
        ? evt.lastEventId
        : String(++counterRef.current);

      const relayEvent: WolfRelayEvent = {
        id,
        event: evt.type !== 'message' ? evt.type : undefined,
        data: parsed,
        receivedAt: Date.now()
      };
      setLastEventId(id);
      if (onEvent) {
        try {
          onEvent(relayEvent);
        } catch (err) {
          if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.warn('[useWolfEvents] onEvent handler error', err);
          }
        }
      }
    };

    es.onerror = () => {
      // Native EventSource will handle retry; we only adjust status if inactivity breaches threshold.
      if (closedRef.current) return;
      const now = Date.now();
      if (now - activityRef.current > reconnectNoticeMs) {
        setStatus(prev => (prev === 'closed' ? 'closed' : 'reconnecting'));
      }
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.debug('[useWolfEvents] error (will auto-retry)');
      }
    };

    // Heartbeat / inactivity checker
    intervalRef.current = window.setInterval(() => {
      if (closedRef.current) return;
      const st = statusRef.current;
      if (st === 'open' || st === 'reconnecting') {
        const now = Date.now();
        if (now - activityRef.current > reconnectNoticeMs) {
          setStatus(prev => (prev === 'closed' ? 'closed' : 'reconnecting'));
        }
      }
    }, 5000);

    return () => {
      disconnect();
    };
  // we intentionally exclude dependencies that would recreate the EventSource
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reconnectNoticeMs, disconnect]);

  // Keep a ref of status for interval logic without re-registering interval.
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  return {
    status,
    lastEventId,
    disconnect
  };
}

// Testing considerations: Potential future exposure of internals via __TEST__ if needed.