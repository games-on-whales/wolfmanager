// Server-Sent Events stream endpoint (authenticated, feature-flag gated)
// Fans out events from the in-process Wolf SSE relay to browser clients.

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getWolfRelay, type WolfRelayEvent } from '@/server/wolf-sse-relay';

// Force dynamic behavior & node runtime (relay uses Node APIs).
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

// Feature flag helper (default enabled).
function isSseEnabled(): boolean {
  const raw = process.env.SSE_RELAY_ENABLED;
  if (!raw) return true;
  const v = raw.trim().toLowerCase();
  return !(v === '0' || v === 'false' || v === 'no' || v === 'off' || v === 'disabled');
}

interface SyntheticIdCounter { value: number }

function formatSse(evt: WolfRelayEvent, syntheticIdCounterRef: SyntheticIdCounter): string {
  const id = evt.id ?? String(++syntheticIdCounterRef.value);
  const eventName = evt.event || 'message';
  const payload = (typeof evt.data === 'string') ? evt.data : JSON.stringify(evt.data);
  return `id: ${id}\nevent: ${eventName}\ndata: ${payload}\n\n`;
}

export async function GET(req: Request): Promise<Response> {
  // Feature flag check
  if (!isSseEnabled()) {
    return new Response(JSON.stringify({ error: 'SSE_DISABLED', disabled: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Authentication
  let session: any;
  try {
    session = await getServerSession(authOptions as any);
  } catch (err) {
    console.debug('[events/stream] getServerSession error', err);
  }
  if (!session) {
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Acquire relay
  const relay = getWolfRelay();
  const state = relay.getState();

  if (state.state === 'disposed') {
    try {
      await relay.start();
    } catch {
      // ignore start failure
    }
    // Re-check
    if (relay.getState().state === 'disposed') {
      return new Response(JSON.stringify({ error: 'RELAY_UNAVAILABLE' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  let closed = false;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let unsubscribe: (() => void) | null = null;

  const syntheticIdCounter: SyntheticIdCounter = { value: 0 };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      console.debug('[events/stream] connection start', { userId: session.user?.id });

      function enqueueString(str: string) {
        if (closed) return;
        try {
          controller.enqueue(new TextEncoder().encode(str));
        } catch {
          // Controller closed
          cleanup();
        }
      }

      // Initial heartbeat comment
      enqueueString(`:hb init\n\n`);

      // Manual replay (chronological)
      try {
        const snapshot = relay.getSnapshot();
        for (const evt of snapshot) {
          enqueueString(formatSse(evt, syntheticIdCounter));
        }
      } catch (err) {
        console.debug('[events/stream] snapshot replay failed', { error: (err as Error).message });
      }

      // Live subscription (no replay)
      unsubscribe = relay.subscribe((evt) => {
        try {
          enqueueString(formatSse(evt, syntheticIdCounter));
        } catch (err) {
          console.debug('[events/stream] enqueue error', { error: (err as Error).message });
        }
      }, { replay: false });

      // Heartbeat every 10s
      heartbeatTimer = setInterval(() => {
        enqueueString(`:hb ${Date.now()}\n\n`);
      }, 10_000);

      // Abort / client disconnect handling
      (req as any)?.signal?.addEventListener?.('abort', () => {
        console.debug('[events/stream] request aborted', { userId: session.user?.id });
        cleanup();
      });
    },
    cancel() {
      console.debug('[events/stream] stream cancel', { userId: session.user?.id });
      cleanup();
    }
  });

  function cleanup() {
    if (closed) return;
    closed = true;
    try {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    } catch {}
    try {
      if (unsubscribe) unsubscribe();
    } catch {}
    try {
      // Controller closed automatically when returning response end
    } catch {}
    console.debug('[events/stream] connection closed', { userId: session.user?.id });
  }

  try {
    return new Response(stream as any, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Vary': 'Cookie',
      },
    });
  } catch (err) {
    cleanup();
    if (!closed) {
      return new Response(JSON.stringify({ error: 'INTERNAL_ERROR' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(null, { status: 499 });
  }
}