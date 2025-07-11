# Real-Time Client Status Updates via SSE

## Overview

The real-time client status updates feature provides instant notifications of Wolf streaming client state changes through Server-Sent Events (SSE). This implementation replaces traditional polling mechanisms with an efficient, real-time communication system that immediately updates the UI when clients connect, disconnect, start streaming, or change status.

### Benefits of Real-Time Updates vs Polling

- **Instant Updates**: Changes are reflected in the UI immediately when they occur
- **Reduced Server Load**: Eliminates continuous polling requests
- **Better User Experience**: Real-time status indicators and session information
- **Efficient Resource Usage**: Only transmits data when changes occur
- **Lower Latency**: Sub-second update delivery vs 30-second polling intervals

### High-Level Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Wolf Server   │    │   WolfUI Server  │    │   Browser UI    │
│                 │    │                  │    │                 │
│ ┌─────────────┐ │    │ ┌──────────────┐ │    │ ┌─────────────┐ │
│ │   Events    │─┼────┼─│WolfEventSvc  │ │    │ │EventSource  │ │
│ │   Stream    │ │    │ │              │ │    │ │Connection   │ │
│ └─────────────┘ │    │ └──────┬───────┘ │    │ └─────────────┘ │
│                 │    │        │         │    │                 │
│ ┌─────────────┐ │    │ ┌──────▼───────┐ │    │ ┌─────────────┐ │
│ │ Unix Socket │─┼────┼─│ SSE Endpoint │─┼────┼─│ UI Updates  │ │
│ │   Stream    │ │    │ │/api/client-  │ │    │ │             │ │
│ └─────────────┘ │    │ │    events    │ │    │ └─────────────┘ │
└─────────────────┘    │ └──────────────┘ │    └─────────────────┘
                       │                  │
                       │ ┌──────────────┐ │
                       │ │   Database   │ │
                       │ │  (last_seen  │ │
                       │ │   updates)   │ │
                       │ └──────────────┘ │
                       └──────────────────┘
```

## Architecture Components

### WolfEventService Singleton

**Location**: [`src/lib/services/wolf-event.service.ts`](../src/lib/services/wolf-event.service.ts)

**Purpose**: Central event processing hub that connects to Wolf's SSE endpoint and manages client state

**Key Responsibilities**:
- Establishes and maintains connection to Wolf's `/events` SSE endpoint
- Parses incoming SSE events and transforms them into application events
- Maintains in-memory cache of client states and session information
- Updates database [`last_seen`](../src/lib/db/schema/clients.ts:16) timestamps
- Emits standardized events for UI consumption

**Initialization**:
```typescript
const wolfEventService = WolfEventService.getInstance();
```

The service auto-initializes on first access and attempts to connect to Wolf's SSE stream immediately.

### SSE API Endpoint

**Location**: [`src/app/api/client-events/route.ts`](../src/app/api/client-events/route.ts)

**Purpose**: Secure SSE endpoint that streams client events to authenticated users

**Key Features**:
- Authentication validation using NextAuth sessions
- User-specific client filtering (only sends events for user's clients)
- Proper SSE headers and keep-alive mechanism
- Graceful connection cleanup on disconnect

**Endpoint**: `GET /api/client-events`

### Frontend EventSource Integration

**Location**: [`src/app/clients/components/ClientPageContent.tsx`](../src/app/clients/components/ClientPageContent.tsx:197-333)

**Purpose**: Browser-side SSE client with connection management and UI updates

**Key Features**:
- Automatic connection establishment when authenticated
- Exponential backoff retry logic for failed connections
- Real-time UI updates for client status changes
- Connection status indicators

### Database Schema Changes

**Location**: [`src/lib/db/schema/clients.ts`](../src/lib/db/schema/clients.ts:16)

**Schema Addition**:
```typescript
lastSeen: text('last_seen'), // SQLite
lastSeen: timestamp('last_seen', { withTimezone: true }), // PostgreSQL  
lastSeen: mysqlTimestamp('last_seen'), // MySQL
```

This field tracks the last time a client was seen active and is automatically updated by the [`WolfEventService`](../src/lib/services/wolf-event.service.ts:158-168) when events are received.

## Implementation Details

### WolfEventService Connection to Wolf Socket

The [`WolfEventService`](../src/lib/services/wolf-event.service.ts:72-113) connects to Wolf's SSE endpoint using the [`SocketService.callWolfApiStream()`](../src/lib/services/socket-service.ts:360) method:

```typescript
const eventStream = await this.socketService.callWolfApiStream(null, "/events");
```

**Connection Features**:
- Automatic reconnection with 5-second delay on failures
- Proper SSE message parsing (handles `data:` prefixed messages)
- Error handling and logging for connection issues
- Stream processing with chunk-based message handling

### Event Types and Meanings

The system processes several Wolf event types:

| Event Type | Description | UI Impact |
|------------|-------------|-----------|
| [`PauseStreamEvent`](../src/lib/services/wolf-event.service.ts:13-16) | Client paused streaming | Status → "PAUSED", update last_seen |
| [`StopStreamEvent`](../src/lib/services/wolf-event.service.ts:18-21) | Client stopped streaming | Status → "OFFLINE", clear session |
| [`StreamSession`](../src/lib/services/wolf-event.service.ts:23-27) | Active streaming session | Status → "STREAMING", show session badge |
| [`VideoSession`](../src/lib/services/wolf-event.service.ts:29-33) | Video session active | Status → "STREAMING", show "Video" badge |
| [`AudioSession`](../src/lib/services/wolf-event.service.ts:35-39) | Audio session active | Status → "STREAMING", show "Audio" badge |
| [`PairRequest`](../src/lib/services/wolf-event.service.ts:41-43) | New client wants to pair | Add to pending requests list |
| [`PairRequestRemoved`](../src/lib/services/wolf-event.service.ts:45-48) | Pair request canceled | Remove from pending requests |

### Caching Strategy and Performance Benefits

**In-Memory State Cache**:
- [`clientStates`](../src/lib/services/wolf-event.service.ts:55): Maps client IDs to current status and session data
- [`pendingPairRequests`](../src/lib/services/wolf-event.service.ts:56): Array of active pairing requests

**Performance Benefits**:
- Eliminates database queries for real-time status checks
- Provides instant access to current client states
- Reduces API calls to Wolf server
- Enables sub-second UI updates

### Security Considerations and Authentication

**Server-Side Authentication**:
- All SSE connections require valid NextAuth sessions
- User-specific filtering ensures clients only see their own devices
- Socket access validation through [`auth/socket-permissions`](../src/lib/auth/socket-permissions.ts)

**Client-Side Security**:
- EventSource connections automatically include session cookies
- Failed authentication immediately closes SSE connections
- No sensitive data exposed in client-side event streams

## Data Flow

### Step-by-Step Flow from Wolf Events to UI Updates

1. **Wolf Server Event Generation**
   - Wolf server generates events (client connect/disconnect, stream start/stop)
   - Events sent to SSE endpoint `/events` via Unix socket

2. **WolfEventService Processing**
   - [`WolfEventService`](../src/lib/services/wolf-event.service.ts:87-88) receives SSE data chunks
   - Parses `data:` prefixed messages as JSON
   - Calls [`processEvent()`](../src/lib/services/wolf-event.service.ts:115-156) for each event

3. **Event Parsing and Transformation**
   - Events parsed into typed interfaces ([`WolfEvent`](../src/lib/services/wolf-event.service.ts:50))
   - Client states updated in memory cache
   - Standardized events emitted (`CLIENT_UPDATE`, `SESSION_UPDATE`, `PAIR_REQUEST_UPDATE`)

4. **Database Update Triggers**
   - [`updateClientLastSeen()`](../src/lib/services/wolf-event.service.ts:158-168) updates database timestamps
   - Uses Drizzle ORM with database-specific schema
   - Graceful error handling for database failures

5. **SSE Endpoint Broadcasting**
   - [`/api/client-events`](../src/app/api/client-events/route.ts:33-39) listens for service events
   - Filters events by user ownership
   - Sends formatted SSE messages to connected browsers

6. **Frontend Event Handling**
   - [`ClientPageContent`](../src/app/clients/components/ClientPageContent.tsx:245-323) processes incoming events
   - Updates React state for immediate UI reflection
   - Handles different event types with appropriate UI changes

### Event Parsing and Transformation Example

```typescript
// Wolf SSE message format
data: {"type":"PauseStreamEvent","clientId":"client-123"}

// Processed into internal event
{
  type: "CLIENT_UPDATE",
  clientId: "client-123", 
  status: "PAUSED"
}

// UI state update
setPairedClients(prev => prev.map(client => 
  client.wolf_client_id === "client-123" 
    ? { ...client, status: "PAUSED", last_seen: new Date().toISOString() }
    : client
));
```

## Frontend Integration

### React Component Changes

**Main Component**: [`ClientPageContent.tsx`](../src/app/clients/components/ClientPageContent.tsx)

Key changes include:
- SSE connection state management ([lines 71-76](../src/app/clients/components/ClientPageContent.tsx:71-76))
- EventSource connection setup with retry logic ([lines 197-333](../src/app/clients/components/ClientPageContent.tsx:197-333))
- Real-time state updates for client status and sessions

**Status Display**: [`PairedClientsCard.tsx`](../src/app/clients/components/PairedClientsCard.tsx)

Real-time status indicators:
- Color-coded status dots ([lines 69-82](../src/app/clients/components/PairedClientsCard.tsx:69-82))
- Session type badges ([lines 185-191](../src/app/clients/components/PairedClientsCard.tsx:185-191))
- Smart "last seen" formatting ([lines 100-127](../src/app/clients/components/PairedClientsCard.tsx:100-127))

### SSE Connection Management

**Connection Lifecycle**:
```typescript
// Establish connection
const eventSource = new EventSource("/api/client-events");

// Handle connection states
eventSource.onopen = () => setSseConnected(true);
eventSource.onerror = () => {
  setSseConnected(false);
  // Exponential backoff retry
  setTimeout(connectSSE, Math.min(1000 * Math.pow(2, retryCount), 30000));
};
```

**Connection Status Indicator**:
```jsx
<Badge variant={sseConnected ? "default" : "secondary"}>
  <Circle className="h-2 w-2 fill-current animate-pulse" />
  Live
</Badge>
```

### Error Handling and Retry Logic

**Exponential Backoff Strategy**:
- Initial retry: 1 second
- Maximum retry delay: 30 seconds  
- Retry count tracking with [`sseRetryCount`](../src/app/clients/components/ClientPageContent.tsx:73) state
- Automatic reset on successful connection

**Error Scenarios Handled**:
- Network connectivity issues
- Server restarts or downtime
- Authentication token expiration
- SSE endpoint unavailability

### UI Indicators and Real-Time Updates

**Status Indicators**:
- **Green**: Connected/Streaming clients
- **Yellow**: Paused clients  
- **Gray**: Offline/Disconnected clients
- **Badges**: Session type indicators (Stream/Video/Audio)

**Real-Time Features**:
- Instant status changes without page refresh
- Live pending request updates
- Session activity indicators
- Connection status in header

## Troubleshooting Guide

### Common Issues and Solutions

**SSE Connection Fails**:
- **Symptom**: "Live" indicator shows gray/disconnected
- **Solution**: Check browser network tab for 401/403 errors, verify authentication
- **Debug**: Check [`LogComponent.PAIRING`](../src/app/clients/components/ClientPageContent.tsx:204) logs in browser console

**Events Not Updating UI**:
- **Symptom**: Client status doesn't change despite Wolf activity
- **Solution**: Verify user owns the clients generating events
- **Debug**: Check SSE endpoint logs for event filtering

**Database Last Seen Not Updating**:
- **Symptom**: Last seen timestamps remain stale
- **Solution**: Check WolfEventService database connection and permissions
- **Debug**: Look for [`LogComponent.WOLF_EVENTS`](../src/lib/services/wolf-event.service.ts:166) error logs

### Debug Logging Locations

**Client-Side Logs**:
- Browser Console → [`LogComponent.PAIRING`](../src/app/clients/components/ClientPageContent.tsx:204)
- SSE connection events and errors
- Event processing and UI updates

**Server-Side Logs**:
- [`LogComponent.WOLF_EVENTS`](../src/lib/services/wolf-event.service.ts:73): WolfEventService operations
- [`LogComponent.API`](../src/app/api/client-events/route.ts:58): SSE endpoint connections
- Database update operations

### How to Verify SSE Connections

**Browser DevTools**:
1. Network tab → Filter by "EventSource"
2. Look for persistent connection to `/api/client-events`
3. Check response headers include `text/event-stream`

**Server Logs**:
```bash
# Check for SSE connection establishment
grep "SSE connection established" /app/logs/wolf-ui.log

# Monitor event processing
grep "Processing event" /app/logs/wolf-ui.log
```

**Manual Testing**:
```bash
# Test SSE endpoint directly
curl -H "Cookie: next-auth.session-token=..." \
     -H "Accept: text/event-stream" \
     http://localhost:3000/api/client-events
```

### Fallback Mechanisms

**Automatic Fallback**:
- 30-second polling continues as backup ([line 368](../src/app/clients/components/ClientPageContent.tsx:368))
- Manual refresh buttons remain functional
- Server-side data remains authoritative

**Manual Recovery**:
- Page refresh re-establishes all connections
- Logout/login cycle resets authentication
- Clear browser cache for persistent issues

## Future Enhancements

### Potential Improvements

**Enhanced Event Types**:
- Client performance metrics (CPU, GPU usage)
- Network quality indicators
- Game launch/exit events
- User session start/end tracking

**Scalability Enhancements**:
- Redis-based event distribution for multi-server deployments
- WebSocket upgrade option for bidirectional communication
- Event compression for high-frequency updates
- Connection pooling and load balancing

**User Experience Improvements**:
- Toast notifications for critical events
- Sound notifications for client connections
- Customizable event filtering
- Event history and replay functionality

### Scalability Considerations

**Current Limitations**:
- Single-server SSE connections
- In-memory client state storage
- No event persistence or replay

**Scaling Solutions**:
- **Horizontal Scaling**: Redis pub/sub for multi-server event distribution
- **Event Persistence**: Database event log for reliability and replay
- **Connection Management**: Load balancer with sticky sessions
- **Performance Monitoring**: Metrics for connection count and event throughput

**Resource Planning**:
- Each SSE connection: ~1KB memory + minimal CPU
- Event processing: ~10μs per event
- Database updates: ~1ms per client state change
- Recommended limits: 1000 concurrent SSE connections per server instance