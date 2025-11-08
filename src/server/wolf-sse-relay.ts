/**
 * Wolf SSE Relay (Phase 1)
 *
 * Self-contained authenticated-upstream-agnostic relay that connects to the Wolf daemon
 * over a UNIX domain socket and fans out Server-Sent Events to in-process subscribers.
 *
 * Lazy, singleton, resilient (exponential backoff + watchdog), bounded memory (ring buffer),
 * and defensive against malformed / oversized frames.
 */

import http from 'http';

/**
 * A parsed relay event emitted to subscribers.
 */
export interface WolfRelayEvent {
  id?: string;
  event?: string;
  data: any;
  receivedAt: number;
  raw?: { lines: string[] };
}

/**
 * Current lifecycle state descriptor of the relay.
 */
export interface RelayStateDescriptor {
  state: 'initializing' | 'connecting' | 'streaming' | 'reconnecting' | 'stopping' | 'disposed';
  backoffIndex: number;
  nextReconnectAt?: number;
  lastEventReceivedAt?: number;
  subscribers: number;
}

/**
 * Cumulative relay metrics since creation.
 */
export interface RelayMetrics {
  totalEvents: number;
  reconnectAttempts: number;
  currentSubscribers: number;
  lastHeartbeatAt?: number;
  createdAt: number;
}

/**
 * Public Wolf SSE Relay interface.
 */
export interface WolfSseRelay {
  /**
   * Explicitly start the relay (idempotent). Usually not required since subscribe() will lazy start.
   */
  start(): Promise<void>;
  /**
   * Stop the relay.
   * dispose=true fully tears down and prevents future restarts.
   */
  stop(options?: { dispose?: boolean }): Promise<void>;
  /**
   * Subscribe a listener to events. If opts.replay=true previous buffered events (ring buffer)
   * are synchronously emitted (oldest -> newest) before returning.
   * Returns an unsubscribe function (idempotent).
   */
  subscribe(listener: (evt: WolfRelayEvent) => void, opts?: { replay?: boolean }): () => void;
  /**
   * Obtain a chronological snapshot copy of buffered events (bounded by ring capacity).
   */
  getSnapshot(): WolfRelayEvent[];
  /**
   * Current state descriptor.
   */
  getState(): RelayStateDescriptor;
  /**
   * Force an immediate reconnect attempt (after small delay) resetting backoff.
   */
  forceReconnect(reason?: string): void;
  /**
   * Current aggregated metrics.
   */
  getMetrics(): RelayMetrics;
}

export function getWolfRelay(): WolfSseRelay {
  const g: any = globalThis as any;
  if (g.__WOLF_SSE_RELAY__) {
    return g.__WOLF_SSE_RELAY__;
  }
  const relay = createWolfRelay();
  g.__WOLF_SSE_RELAY__ = relay;
  return relay;
}

// ----------------------------------------------------------------------------
// Implementation
// ----------------------------------------------------------------------------

const BACKOFFS = [1000, 2000, 4000, 8000, 16000, 30000];
const WATCHDOG_TIMEOUT_MS = 25_000;
const SUMMARY_INTERVAL_MS = 60_000;
const RING_CAPACITY = 100;
const MAX_FRAME_SIZE_BYTES = 1_000_000;

interface FrameAccumulator {
  id?: string;
  event?: string;
  dataLines: string[];
  rawLines: string[];
  sizeBytes: number;
}

type InternalState = RelayStateDescriptor['state'];

interface InternalTimers {
  reconnect?: NodeJS.Timeout;
  watchdog?: NodeJS.Timeout;
  summary?: NodeJS.Timeout;
}

function createWolfRelay(): WolfSseRelay {
  let state: InternalState = 'initializing';
  let backoffIndex = 0;
  let nextReconnectAt: number | undefined;
  let lastEventReceivedAt: number | undefined;

  // Metrics
  const metrics: RelayMetrics = {
    totalEvents: 0,
    reconnectAttempts: 0,
    currentSubscribers: 0,
    createdAt: Date.now(),
    lastHeartbeatAt: undefined,
  };

  // Subscribers
  const subscribers = new Set<(evt: WolfRelayEvent) => void>();

  // Ring buffer
  const ring: (WolfRelayEvent | undefined)[] = new Array(RING_CAPACITY);
  let ringHead = 0; // next insertion index
  let ringSize = 0;

  // Upstream connection references
  let req: http.ClientRequest | null = null;
  let res: http.IncomingMessage | null = null;

  // SSE parsing state
  let frame: FrameAccumulator | null = newFrame();
  let partialLine = '';

  // Timers
  const timers: InternalTimers = {};

  // Flags
  let stopping = false;
  let disposed = false;
  let loggedPartialDiscard = false;

  function log(prefix: string, msg: string, extra?: Record<string, any>) {
    // Basic structured-ish logging using console.debug; categories prefixed.
    const payload = extra ? ` ${JSON.stringify(extra)}` : '';
    // eslint-disable-next-line no-console
    console.debug(`${prefix} ${msg}${payload}`);
  }

  function newFrame(): FrameAccumulator {
    return {
      dataLines: [],
      rawLines: [],
      sizeBytes: 0,
    };
  }

  function clearTimer(name: keyof InternalTimers) {
    const t = timers[name];
    if (t) {
      clearTimeout(t);
      timers[name] = undefined;
    }
  }

  function clearAllTimers() {
    clearTimer('reconnect');
    clearTimer('watchdog');
    clearTimer('summary');
  }

  function scheduleWatchdog() {
    clearTimer('watchdog');
    timers.watchdog = setTimeout(() => {
      log('relay.reconnect', 'Watchdog timeout - forcing reconnect', { reason: 'watchdog_timeout' });
      forceReconnect('watchdog_timeout');
    }, WATCHDOG_TIMEOUT_MS);
  }

  function scheduleSummary() {
    clearTimer('summary');
    timers.summary = setInterval(() => {
      if (state === 'streaming') {
        log('relay.lifecycle', 'Periodic summary', {
          subscribers: subscribers.size,
          totalEvents: metrics.totalEvents,
          reconnectAttempts: metrics.reconnectAttempts,
          lastEventReceivedAt,
          lastHeartbeatAt: metrics.lastHeartbeatAt,
          backoffIndex,
        });
      }
    }, SUMMARY_INTERVAL_MS) as unknown as NodeJS.Timeout;
  }

  function pushToRing(evt: WolfRelayEvent) {
    ring[ringHead] = evt;
    ringHead = (ringHead + 1) % RING_CAPACITY;
    if (ringSize < RING_CAPACITY) {
      ringSize++;
    }
  }

  function emitEvent(evt: WolfRelayEvent) {
    // Event logging sampling: log if gap > 5s or every 20th event
    const prev = lastEventReceivedAt;
    lastEventReceivedAt = evt.receivedAt;
    metrics.lastHeartbeatAt = evt.receivedAt; // heartbeat conceptually satisfied because data arrived
    const shouldLog =
      !prev ||
      (evt.receivedAt - prev > 5000) ||
      (metrics.totalEvents % 20 === 0);

    if (shouldLog) {
      log('relay.event', 'Emitting event', {
        id: evt.id,
        event: evt.event,
        totalEvents: metrics.totalEvents + 1,
      });
    }

    pushToRing(evt);
    metrics.totalEvents++;

    for (const listener of [...subscribers]) {
      try {
        listener(evt);
      } catch (err) {
        log('relay.event', 'Listener threw error', { error: (err as Error).message });
      }
    }
  }

  function parseAndEmitFrame() {
    if (!frame) return;
    const hasData = frame.dataLines.length > 0;
    const hasMeta = frame.id || frame.event;
    if (!hasData && !hasMeta) {
      frame = newFrame();
      return;
    }
    const joined = frame.dataLines.join('\n');
    let parsed: any = joined;
    const trimmed = joined.trimStart();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        parsed = JSON.parse(joined);
      } catch {
        // Keep raw string
      }
    }
    const evt: WolfRelayEvent = {
      id: frame.id,
      event: frame.event,
      data: parsed,
      receivedAt: Date.now(),
      raw: { lines: [...frame.rawLines] },
    };
    emitEvent(evt);
    frame = newFrame();
  }

  function processLine(line: string) {
    scheduleWatchdog(); // any line resets watchdog
    metrics.lastHeartbeatAt = Date.now();

    if (frame == null) frame = newFrame();
    // Trim trailing CR
    if (line.endsWith('\r')) {
      line = line.slice(0, -1);
    }

    if (line === '') {
      // End of event
      parseAndEmitFrame();
      return;
    }

    if (line.startsWith(':')) {
      // Comment / heartbeat
      // Optionally record raw line for debugging
      frame.rawLines.push(line);
      return;
    }

    frame.rawLines.push(line);

    // Field parsing per SSE spec (field: [value])
    const idx = line.indexOf(':');
    let field: string;
    let value: string;
    if (idx === -1) {
      field = line;
      value = '';
    } else {
      field = line.slice(0, idx);
      value = line.slice(idx + 1);
      if (value.startsWith(' ')) value = value.slice(1);
    }

    switch (field) {
      case 'id':
        frame.id = value;
        break;
      case 'event':
        frame.event = value;
        break;
      case 'data':
        frame.dataLines.push(value);
        frame.sizeBytes += value.length;
        if (frame.sizeBytes > MAX_FRAME_SIZE_BYTES) {
          log('relay.event', 'Dropping oversized frame', { size: frame.sizeBytes });
          frame = newFrame();
        }
        break;
      // ignore retry or unknown fields
      default:
        break;
    }
  }

  function handleChunk(chunk: string) {
    const data = partialLine + chunk;
    const lines = data.split('\n');
    partialLine = lines.pop() || '';
    for (const line of lines) {
      processLine(line);
    }
  }

  function finalizeStream() {
    // If partial line or frame incomplete: discard (log once)
    if (frame && (frame.dataLines.length > 0 || frame.id || frame.event)) {
      if (!loggedPartialDiscard) {
        log('relay.lifecycle', 'Discarding incomplete frame at stream end');
        loggedPartialDiscard = true;
      }
    }
    frame = newFrame();
    partialLine = '';
  }

  function currentSocketPath(): string {
    const p = process.env.WOLF_SOCKET_PATH || '/var/run/wolf/wolf.sock';
    return p;
  }

  function connect() {
    if (disposed) return;
    const socketPath = currentSocketPath();
    try {
      state = 'connecting';
      log('relay.lifecycle', 'Connecting upstream', { socketPath, path: '/api/v1/events' });

      const options: http.RequestOptions = {
        socketPath,
        path: '/api/v1/events',
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          Connection: 'keep-alive',
        },
      };

      req = http.request(options, (response) => {
        res = response;
        if (response.statusCode && response.statusCode >= 400) {
          log('relay.lifecycle', 'Upstream responded with error status', { status: response.statusCode });
          response.resume(); // drain
        }
        response.setEncoding('utf8');

        response.on('data', (chunk: string) => {
          if (state !== 'streaming') {
            state = 'streaming';
            log('relay.lifecycle', 'Streaming started');
            // Successful data receipt resets backoff
            backoffIndex = 0;
            scheduleSummary();
          }
          handleChunk(chunk);
        });

        response.on('end', () => {
          log('relay.lifecycle', 'Upstream ended');
          finalizeStream();
          cleanupConnection();
          if (!stopping && !disposed) {
            scheduleReconnect('end');
          }
        });

        response.on('close', () => {
          log('relay.lifecycle', 'Upstream closed');
          finalizeStream();
          cleanupConnection();
          if (!stopping && !disposed) {
            scheduleReconnect('close');
          }
        });
      });

      req.on('error', (err) => {
        log('relay.lifecycle', 'Upstream request error', { error: (err as Error).message });
        cleanupConnection();
        if (!stopping && !disposed) {
          scheduleReconnect('error');
        }
      });

      req.end();
      scheduleWatchdog();
    } catch (err) {
      log('relay.lifecycle', 'Connect exception', { error: (err as Error).message });
      cleanupConnection();
      if (!stopping && !disposed) {
        scheduleReconnect('exception');
      }
    }
  }

  function cleanupConnection() {
    clearTimer('watchdog');
    if (req) {
      try {
        req.destroy();
      } catch {
        // ignore
      }
    }
    if (res) {
      try {
        res.destroy();
      } catch {
        // ignore
      }
    }
    req = null;
    res = null;
  }

  function scheduleReconnect(reason: string) {
    if (disposed || stopping) return;
    if (state === 'reconnecting') {
      // Already scheduled; keep earlier schedule
      return;
    }
    state = 'reconnecting';
    const delay = BACKOFFS[Math.min(backoffIndex, BACKOFFS.length - 1)];
    nextReconnectAt = Date.now() + delay;
    metrics.reconnectAttempts++;
    log('relay.reconnect', 'Scheduling reconnect', {
      reason,
      backoffIndex,
      delay,
      attempt: metrics.reconnectAttempts,
    });
    clearTimer('reconnect');
    timers.reconnect = setTimeout(() => {
      nextReconnectAt = undefined;
      if (disposed || stopping) return;
      connect();
      if (backoffIndex < BACKOFFS.length - 1) {
        backoffIndex++;
      }
    }, delay);
  }

  function forceReconnect(reason?: string) {
    if (disposed) {
      log('relay.reconnect', 'Force reconnect ignored (disposed)');
      return;
    }
    log('relay.reconnect', 'Force reconnect requested', { reason });
    backoffIndex = 0;
    cleanupConnection();
    clearTimer('reconnect');
    state = 'reconnecting';
    nextReconnectAt = Date.now() + 50;
    timers.reconnect = setTimeout(() => {
      nextReconnectAt = undefined;
      connect();
    }, 50);
  }

  async function start(): Promise<void> {
    if (disposed) {
      log('relay.lifecycle', 'Start ignored (disposed)');
      return;
    }
    if (state === 'streaming' || state === 'connecting') {
      return;
    }
    if (state === 'reconnecting') {
      // Already scheduled
      return;
    }
    stopping = false;
    connect();
  }

  async function stop(options?: { dispose?: boolean }): Promise<void> {
    const dispose = options?.dispose;
    if (disposed) return;
    stopping = true;
    state = dispose ? 'disposed' : 'stopping';
    clearAllTimers();
    cleanupConnection();
    frame = newFrame();
    partialLine = '';
    nextReconnectAt = undefined;
    if (dispose) {
      disposed = true;
      // Optionally clear ring buffer for dispose
      for (let i = 0; i < RING_CAPACITY; i++) {
        ring[i] = undefined;
      }
      ringHead = 0;
      ringSize = 0;
      log('relay.lifecycle', 'Disposed');
    } else {
      // Allow restart
      state = 'initializing';
      stopping = false;
      log('relay.lifecycle', 'Stopped (reset to initializing)');
    }
  }

  function subscribe(
    listener: (evt: WolfRelayEvent) => void,
    opts?: { replay?: boolean },
  ): () => void {
    if (disposed) {
      log('relay.subscribers', 'Subscribe ignored (disposed)');
      return () => {
        /* noop */
      };
    }
    subscribers.add(listener);
    metrics.currentSubscribers = subscribers.size;
    log('relay.subscribers', 'Subscriber added', { count: subscribers.size });

    if (opts?.replay) {
      for (const evt of getSnapshot()) {
        try {
          listener(evt);
        } catch (err) {
          log('relay.event', 'Replay listener error', { error: (err as Error).message });
        }
      }
    }

    // Lazy start
    if (state === 'initializing') {
      void start();
    }

    return () => {
      if (subscribers.delete(listener)) {
        metrics.currentSubscribers = subscribers.size;
        log('relay.subscribers', 'Subscriber removed', { count: subscribers.size });
      }
    };
  }

  function getSnapshot(): WolfRelayEvent[] {
    const out: WolfRelayEvent[] = [];
    if (ringSize === 0) return out;
    const startIndex = (ringHead - ringSize + RING_CAPACITY) % RING_CAPACITY;
    for (let i = 0; i < ringSize; i++) {
      const idx = (startIndex + i) % RING_CAPACITY;
      const evt = ring[idx];
      if (evt) out.push(evt);
    }
    return out;
  }

  function getState(): RelayStateDescriptor {
    return {
      state,
      backoffIndex,
      nextReconnectAt,
      lastEventReceivedAt,
      subscribers: subscribers.size,
    };
  }

  function getMetrics(): RelayMetrics {
    return { ...metrics };
  }

  const api: WolfSseRelay = {
    start,
    stop,
    subscribe,
    getSnapshot,
    getState,
    forceReconnect,
    getMetrics,
  };

  return api;
}