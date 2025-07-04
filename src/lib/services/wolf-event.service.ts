import { EventEmitter } from "events";
import { SocketService } from "./socket-service";
import { logger, LogComponent } from "@/lib/logger";
import { getDatabase } from "@/lib/db";
import { databaseConfig } from "@/lib/db/config";
import { clientDevicesSqlite, clientDevicesPostgres, clientDevicesMysql } from "@/lib/db/schema";
import type { PendingPairRequest } from "@/lib/api/wolf-pair";
import { eq } from "drizzle-orm";

const clientDevices = databaseConfig.type === 'sqlite' ? clientDevicesSqlite : databaseConfig.type === 'postgresql' ? clientDevicesPostgres : clientDevicesMysql;

// Define event types from Wolf SSE
interface PauseStreamEvent {
    type: "wolf::core::events::PauseStreamEvent";
    session_id: number;
}

interface StopStreamEvent {
    type: "wolf::core::events::StopStreamEvent";
    session_id: number;
}

interface StreamSession {
    type: "wolf::core::events::StreamSession";
    client_id: string;
    client_ip: string;
    // ... other properties
}

interface VideoSession {
    type: "wolf::core::events::VideoSession";
    session_id: number;
    // ... other properties
}

interface AudioSession {
    type: "wolf::core::events::AudioSession";
    session_id: number;
    // ... other properties
}

interface PairSignalEvent {
    type: "wolf::core::events::PairSignal";
    client_ip: string;
    host_ip: string;
}

interface ResumeStreamEvent {
    type: "wolf::core::events::ResumeStreamEvent";
    session_id: number;
}

interface PlugDeviceEvent {
    type: "wolf::core::events::PlugDeviceEvent";
    device_id: string;
    device_type: string;
    vendor_id?: string;
    product_id?: string;
}

interface UnplugDeviceEvent {
    type: "wolf::core::events::UnplugDeviceEvent";
    device_id: string;
    device_type: string;
}

interface IDRRequestEvent {
    type: "wolf::core::events::IDRRequestEvent";
    session_id: number;
}

interface StartRunnerEvent {
    type: "wolf::core::events::StartRunner";
    runner_id: string;
    app_id: string;
    session_id?: number;
}

interface RTPVideoPingEvent {
    type: "wolf::core::events::RTPVideoPingEvent";
    session_id: number;
    ping_payload: number[];
}

interface RTPAudioPingEvent {
    type: "wolf::core::events::RTPAudioPingEvent";
    session_id: number;
    ping_payload: number[];
}

interface PairRequestEvent extends PendingPairRequest {
    type: "PairRequest";
}

interface PairRequestRemovedEvent {
    pair_secret: string;
    type: "PairRequestRemoved";
}

type WolfEvent = PauseStreamEvent | StopStreamEvent | ResumeStreamEvent | StreamSession | VideoSession | AudioSession | PairSignalEvent | PlugDeviceEvent | UnplugDeviceEvent | IDRRequestEvent | StartRunnerEvent | RTPVideoPingEvent | RTPAudioPingEvent | PairRequestEvent | PairRequestRemovedEvent;

export class WolfEventService extends EventEmitter {
    private static instance: WolfEventService | null = null;
    private socketService: SocketService;
    private reconnectAttempts: number = 0;
    private readonly maxReconnectAttempts: number = 5;
    private clientStates: Map<string, { status: string; session?: any; lastSeen?: Date }> = new Map();
    private pendingPairRequests: PendingPairRequest[] = [];
    private isInitialized = false;
    
    // Memory management configuration
    private readonly MAX_CLIENT_STATES = 1000; // Maximum number of client states to cache
    private readonly CLIENT_STATE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // Run cleanup every hour
    private cleanupTimer: NodeJS.Timeout | null = null;
    private readonly reconnectDelay: number = 5000; // 5 seconds
    private sessionValidationTimer: NodeJS.Timeout | null = null;
    private readonly sessionValidationInterval: number = 5 * 60 * 1000; // 5 minutes

    private constructor() {
        super();
        this.socketService = SocketService.getInstance();
        this.connectToWolfEvents();
        this.startPeriodicCleanup();
        this.startSessionValidation();
this.on('error', (error) => {
            logger.error(LogComponent.WOLF_EVENTS, "An error occurred in WolfEventService", error);
        });
    }

    public static getInstance(): WolfEventService {
        if (!WolfEventService.instance) {
            // Double-checked locking to ensure thread safety
            if (!WolfEventService.instance) {
                WolfEventService.instance = new WolfEventService();
            }
        }
        return WolfEventService.instance;
    }

    private async connectToWolfEvents() {
        logger.info(LogComponent.WOLF_EVENTS, "Connecting to Wolf SSE endpoint...");
        
        // Add debug logging for socket availability
        logger.debug(LogComponent.WOLF_EVENTS, "Checking Wolf socket availability");
        
        try {
            // Use internal service method with proper authentication
            logger.debug(LogComponent.WOLF_EVENTS, "Attempting to connect to Wolf /events endpoint");
            const eventStream = await this.socketService.callWolfApiStreamInternal("/events");
            
            // Add immediate connection verification
            logger.info(LogComponent.WOLF_EVENTS, "Wolf event stream object created", {
                streamExists: !!eventStream,
                streamReadable: eventStream?.readable,
                streamHeaders: eventStream?.headers
            });
            logger.info(LogComponent.WOLF_EVENTS, "Successfully connected to Wolf SSE endpoint");
            this.isInitialized = true;

            this.reconnectAttempts = 0;
            const baseReconnectDelay = this.reconnectDelay;

            eventStream.on("data", (chunk: Buffer) => {
                try {
                    const message = chunk.toString();
                    logger.info(LogComponent.WOLF_EVENTS, "Raw data received from Wolf events stream", {
                        chunkSize: chunk.length,
                        messagePreview: message.substring(0, 200),
                        messageLength: message.length
                    });
                    
                    // SSE messages are separated by double newlines
                    const events = message.split("\n\n");
                    for (const event of events) {
                        if (event.trim() === "" || event.startsWith(":keepalive")) {
                            // Skip empty events and keepalive messages
                            continue;
                        }
                        
                        // Parse SSE format: event: type\ndata: json
                        const lines = event.split("\n");
                        let eventType = "";
                        let eventData = "";
                        
                        for (const line of lines) {
                            if (line.startsWith("event:")) {
                                eventType = line.substring(6).trim();
                            } else if (line.startsWith("data:")) {
                                eventData = line.substring(5).trim();
                            }
                        }
                        
                        if (eventData) {
                            try {
                                const parsedEvent: WolfEvent = JSON.parse(eventData);
                                
                                // Add the event type if it wasn't in the JSON data
                                if (eventType && !parsedEvent.type) {
                                    (parsedEvent as any).type = eventType;
                                }
                                
                                logger.info(LogComponent.WOLF_EVENTS, "Parsed Wolf SSE event", { 
                                    eventType: eventType || parsedEvent.type, 
                                    eventData: parsedEvent,
                                    rawData: eventData.substring(0, 200),
                                    rawEvent: event.substring(0, 100)
                                });
                                
                                this.processEvent(parsedEvent);
                                // Reset reconnect attempts on successful data
                                this.reconnectAttempts = 0;
                            } catch (error) {
                                logger.error(LogComponent.WOLF_EVENTS, "Failed to parse SSE event JSON", error, {
                                    eventType,
                                    data: eventData.substring(0, 100),
                                    rawEvent: event.substring(0, 100)
                                });
                            }
                        } else {
                            logger.debug(LogComponent.WOLF_EVENTS, "Skipping SSE event without data", {
                                eventType,
                                rawEvent: event.substring(0, 100)
                            });
                        }
                    }
                } catch (error) {
                    logger.error(LogComponent.WOLF_EVENTS, "Error processing event stream chunk", error);
                }
            });

            eventStream.on("end", () => {
                logger.warn(LogComponent.WOLF_EVENTS, "Wolf SSE connection closed", {
                    reconnectAttempts: this.reconnectAttempts,
                    maxReconnectAttempts: this.maxReconnectAttempts
                });
                this.isInitialized = false;
                
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    const delay = Math.min(baseReconnectDelay * Math.pow(2, this.reconnectAttempts), 60000); // Max 1 minute
                    this.reconnectAttempts++;
                    logger.info(LogComponent.WOLF_EVENTS, `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
                    setTimeout(() => this.connectToWolfEvents(), delay);
                } else {
                    logger.error(LogComponent.WOLF_EVENTS, "Max reconnection attempts reached. Service will not reconnect automatically.");
                }
            });

            this.on("SESSION_INVALID", () => {
                logger.warn(LogComponent.WOLF_EVENTS, "Session is invalid, terminating SSE connection.");
                eventStream.destroy();
            });

            eventStream.on("error", (error: Error) => {
                logger.error(LogComponent.WOLF_EVENTS, "Wolf SSE connection error", error);
                this.isInitialized = false;
                
                // Don't increment reconnect attempts for errors, let 'end' event handle it
                // This prevents double-counting
            });

            // Clean up on process exit
            process.once('SIGINT', () => {
                logger.info(LogComponent.WOLF_EVENTS, "SIGINT received, closing Wolf SSE connection");
                eventStream.destroy();
                this.dispose();
            });

            process.once('SIGTERM', () => {
                logger.info(LogComponent.WOLF_EVENTS, "SIGTERM received, closing Wolf SSE connection");
                eventStream.destroy();
                this.dispose();
            });

        } catch (error) {
            logger.error(LogComponent.WOLF_EVENTS, "Failed to connect to Wolf SSE endpoint", error, {
                errorMessage: error instanceof Error ? error.message : String(error),
                errorStack: error instanceof Error ? error.stack : undefined,
                socketServiceInitialized: !!this.socketService
            });
            this.isInitialized = false;
            
            // Use exponential backoff for connection failures
            const delay = Math.min(5000 * Math.pow(2, Math.min(this.reconnectAttempts, 5)), 60000);
            this.reconnectAttempts++;
            
            if (this.reconnectAttempts <= this.maxReconnectAttempts) {
                logger.info(LogComponent.WOLF_EVENTS, `Retrying connection in ${delay}ms (attempt ${this.reconnectAttempts})`);
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    setTimeout(() => this.connectToWolfEvents(), delay);
                } else {
                    logger.error(LogComponent.WOLF_EVENTS, "Max reconnection attempts reached. Service will not reconnect automatically.");
                }
            } else {
                logger.error(LogComponent.WOLF_EVENTS, "Failed to establish Wolf SSE connection after maximum attempts");
            }
        }
    }

    private async processEvent(event: WolfEvent) {
        // Ensure the event has a type field
        const eventType = event.type || (event as any).eventType;
        if (!eventType) {
            logger.warn(LogComponent.WOLF_EVENTS, "Event missing type field", { event });
            return;
        }
        
        logger.info(LogComponent.WOLF_EVENTS, `Processing event: ${eventType}`, { event });
        switch (eventType) {
            case "wolf::core::events::PauseStreamEvent": {
                const pauseEvent = event as PauseStreamEvent;
                const pauseClientId = String(pauseEvent.session_id);
                this.clientStates.set(pauseClientId, {
                    ...this.clientStates.get(pauseClientId),
                    status: "PAUSED",
                    lastSeen: new Date(),
                });
                await this.updateClientLastSeen(pauseClientId);
                this.emit("CLIENT_UPDATE", { clientId: pauseClientId, status: "PAUSED" });
                break;
            }
            case "wolf::core::events::StopStreamEvent": {
                const stopEvent = event as StopStreamEvent;
                const stopClientId = String(stopEvent.session_id);
                this.clientStates.set(stopClientId, {
                    status: "OFFLINE",
                    session: undefined,
                    lastSeen: new Date(),
                });
                await this.updateClientLastSeen(stopClientId);
                this.emit("CLIENT_UPDATE", { clientId: stopClientId, status: "OFFLINE" });
                break;
            }
            case "wolf::core::events::StreamSession": {
                const streamEvent = event as StreamSession;
                this.clientStates.set(streamEvent.client_id, { status: "STREAMING", session: streamEvent });
                this.emit("SESSION_UPDATE", streamEvent);
                break;
            }
            case "wolf::core::events::VideoSession":
            case "wolf::core::events::AudioSession": {
                const sessionEvent = event as VideoSession | AudioSession;
                const sessionClientId = String(sessionEvent.session_id);
                this.clientStates.set(sessionClientId, { status: "STREAMING", session: sessionEvent });
                this.emit("SESSION_UPDATE", sessionEvent);
                break;
            }
            case "wolf::core::events::ResumeStreamEvent": {
                const resumeEvent = event as ResumeStreamEvent;
                const resumeClientId = String(resumeEvent.session_id);
                this.clientStates.set(resumeClientId, {
                    ...this.clientStates.get(resumeClientId),
                    status: "STREAMING",
                    lastSeen: new Date(),
                });
                await this.updateClientLastSeen(resumeClientId);
                this.emit("CLIENT_UPDATE", { clientId: resumeClientId, status: "STREAMING" });
                break;
            }
            case "wolf::core::events::PairSignal": {
                const pairEvent = event as PairSignalEvent;
                // Wolf sends PairSignal events when pairing is requested
                // We need to fetch the actual pending requests from the API
                logger.info(LogComponent.WOLF_EVENTS, "Received PairSignal event", { 
                    client_ip: pairEvent.client_ip, 
                    host_ip: pairEvent.host_ip 
                });
                this.emit("PAIR_REQUEST_UPDATE", []); // Trigger UI refresh - client will call API
                break;
            }
            case "wolf::core::events::PlugDeviceEvent": {
                const plugEvent = event as PlugDeviceEvent;
                logger.info(LogComponent.WOLF_EVENTS, "Device plugged in", {
                    device_id: plugEvent.device_id,
                    device_type: plugEvent.device_type,
                    vendor_id: plugEvent.vendor_id,
                    product_id: plugEvent.product_id
                });
                this.emit("DEVICE_UPDATE", { 
                    action: "PLUG", 
                    device: plugEvent 
                });
                break;
            }
            case "wolf::core::events::UnplugDeviceEvent": {
                const unplugEvent = event as UnplugDeviceEvent;
                logger.info(LogComponent.WOLF_EVENTS, "Device unplugged", {
                    device_id: unplugEvent.device_id,
                    device_type: unplugEvent.device_type
                });
                this.emit("DEVICE_UPDATE", { 
                    action: "UNPLUG", 
                    device: unplugEvent 
                });
                break;
            }
            case "wolf::core::events::IDRRequestEvent": {
                const idrEvent = event as IDRRequestEvent;
                const idrClientId = String(idrEvent.session_id);
                logger.debug(LogComponent.WOLF_EVENTS, "IDR request received", {
                    session_id: idrEvent.session_id
                });
                this.emit("IDR_REQUEST", { clientId: idrClientId, session_id: idrEvent.session_id });
                break;
            }
            case "wolf::core::events::StartRunner": {
                const runnerEvent = event as StartRunnerEvent;
                logger.info(LogComponent.WOLF_EVENTS, "Runner started", {
                    runner_id: runnerEvent.runner_id,
                    app_id: runnerEvent.app_id,
                    session_id: runnerEvent.session_id
                });
                this.emit("RUNNER_UPDATE", { 
                    action: "START", 
                    runner: runnerEvent 
                });
                break;
            }
            case "wolf::core::events::RTPVideoPingEvent": {
                const videoPingEvent = event as RTPVideoPingEvent;
                const videoPingClientId = String(videoPingEvent.session_id);
                logger.debug(LogComponent.WOLF_EVENTS, "RTP video ping received", {
                    session_id: videoPingEvent.session_id,
                    ping_payload_length: videoPingEvent.ping_payload.length
                });
                this.emit("RTP_PING", { 
                    clientId: videoPingClientId, 
                    type: "video",
                    session_id: videoPingEvent.session_id,
                    ping_payload: videoPingEvent.ping_payload
                });
                break;
            }
            case "wolf::core::events::RTPAudioPingEvent": {
                const audioPingEvent = event as RTPAudioPingEvent;
                const audioPingClientId = String(audioPingEvent.session_id);
                logger.debug(LogComponent.WOLF_EVENTS, "RTP audio ping received", {
                    session_id: audioPingEvent.session_id,
                    ping_payload_length: audioPingEvent.ping_payload.length
                });
                this.emit("RTP_PING", { 
                    clientId: audioPingClientId, 
                    type: "audio",
                    session_id: audioPingEvent.session_id,
                    ping_payload: audioPingEvent.ping_payload
                });
                break;
            }
            case "PairRequest": {
                const pairReqEvent = event as PairRequestEvent;
                // Add if not already present
                if (!this.pendingPairRequests.some(req => req.pair_secret === pairReqEvent.pair_secret)) {
                    this.pendingPairRequests.push(pairReqEvent);
                }
                this.emit("PAIR_REQUEST_UPDATE", this.pendingPairRequests);
                break;
            }
            case "PairRequestRemoved": {
                const pairRemovedEvent = event as PairRequestRemovedEvent;
                this.pendingPairRequests = this.pendingPairRequests.filter(
                    req => req.pair_secret !== pairRemovedEvent.pair_secret
                );
                this.emit("PAIR_REQUEST_UPDATE", this.pendingPairRequests);
                break;
            }
            default:
                logger.warn(LogComponent.WOLF_EVENTS, `Unknown event type received: ${(event as any).type}`, { 
                    event,
                    availableTypes: [
                        "wolf::core::events::PauseStreamEvent", 
                        "wolf::core::events::StopStreamEvent", 
                        "wolf::core::events::ResumeStreamEvent",
                        "wolf::core::events::StreamSession", 
                        "wolf::core::events::VideoSession", 
                        "wolf::core::events::AudioSession", 
                        "wolf::core::events::PairSignal",
                        "wolf::core::events::PlugDeviceEvent",
                        "wolf::core::events::UnplugDeviceEvent",
                        "wolf::core::events::IDRRequestEvent",
                        "wolf::core::events::StartRunner",
                        "wolf::core::events::RTPVideoPingEvent",
                        "wolf::core::events::RTPAudioPingEvent"
                    ]
                });
                break;
        }
    }

    private async updateClientLastSeen(clientId: string) {
        try {
            const db = await getDatabase();
            await (db as any).update(clientDevices).set({
                lastSeen: new Date()
            }).where(eq(clientDevices.wolfClientId, clientId));
            logger.info(LogComponent.WOLF_EVENTS, `Updated lastSeen for client: ${clientId}`);
        } catch (error) {
            logger.error(LogComponent.WOLF_EVENTS, `Failed to update lastSeen for client: ${clientId}`, error);
        }
    }

    public getIsInitialized(): boolean {
        return this.isInitialized;
    }

    public getPendingPairRequests(): PendingPairRequest[] {
        logger.debug(LogComponent.WOLF_EVENTS, "Getting pending pair requests from cache", { count: this.pendingPairRequests.length });
        return [...this.pendingPairRequests];
    }

    public getAllClientStates(): { clientId: string; status: string; lastSeen?: Date }[] {
        return Array.from(this.clientStates.entries()).map(([clientId, state]) => ({
            clientId,
            status: state.status,
            lastSeen: state.lastSeen,
        }));
    }

    public getClientStatus(clientId: string): { status: string; lastSeen?: Date } | undefined {
        const state = this.clientStates.get(clientId);
        if (!state) return undefined;
        return { status: state.status, lastSeen: state.lastSeen };
    }

    public getClientSession(clientId: string): any | undefined {
        return this.clientStates.get(clientId)?.session;
    }

    /**
     * Start periodic cleanup of stale client states
     */
    private startPeriodicCleanup(): void {
        // Clear any existing timer
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }

        // Run cleanup immediately
        this.cleanupStaleClientStates();

        // Schedule periodic cleanup
        this.cleanupTimer = setInterval(() => {
            this.cleanupStaleClientStates();
        }, this.CLEANUP_INTERVAL);

        logger.info(LogComponent.WOLF_EVENTS, "Started periodic cleanup of client states", {
            interval: this.CLEANUP_INTERVAL,
            maxStates: this.MAX_CLIENT_STATES,
            ttl: this.CLIENT_STATE_TTL
        });
    }

    /**
     * Clean up stale client states to prevent memory growth
     */
    private cleanupStaleClientStates(): void {
        const now = Date.now();
        let removedCount = 0;
        const statesToRemove: string[] = [];

        // Find stale entries
        for (const [clientId, state] of this.clientStates.entries()) {
            if (state.lastSeen) {
                const age = now - state.lastSeen.getTime();
                if (age > this.CLIENT_STATE_TTL) {
                    statesToRemove.push(clientId);
                }
            }
        }

        // Remove stale entries
        for (const clientId of statesToRemove) {
            this.clientStates.delete(clientId);
            removedCount++;
        }

        // If still over limit, remove oldest entries
        // If still over limit, remove oldest entries
        while (this.clientStates.size > this.MAX_CLIENT_STATES) {
            const oldestClientId = this.clientStates.keys().next().value;
            if (oldestClientId) {
                this.clientStates.delete(oldestClientId);
                removedCount++;
            } else {
                // Should not happen, but as a safeguard
                break;
            }
        }

        if (removedCount > 0) {
            logger.info(LogComponent.WOLF_EVENTS, "Cleaned up stale client states", {
                removedCount,
                remainingCount: this.clientStates.size
            });
        }
    }

    /**
     * Cleanup resources when shutting down
     */
    public dispose(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        this.clientStates.clear();
        this.pendingPairRequests = [];
        this.removeAllListeners();
        logger.info(LogComponent.WOLF_EVENTS, "WolfEventService disposed");
    }

    private startSessionValidation(): void {
        if (this.sessionValidationTimer) {
            clearInterval(this.sessionValidationTimer);
        }

        this.sessionValidationTimer = setInterval(async () => {
            logger.info(LogComponent.WOLF_EVENTS, "Revalidating session...");
            const response = await this.socketService.revalidateSession(null);
            if (!response.success) {
                this.emit("SESSION_INVALID");
            }
        }, this.sessionValidationInterval);
    }
}