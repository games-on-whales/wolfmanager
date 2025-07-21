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
    session_id: string; // Fixed: Use string to prevent precision loss
}

interface StopStreamEvent {
    type: "wolf::core::events::StopStreamEvent";
    session_id: string; // Fixed: Use string to prevent precision loss
}

interface StreamSession {
    type: "wolf::core::events::StreamSession";
    client_id: string;
    client_ip: string;
    app_id: string;
    aes_key: string;
    aes_iv: string;
    rtsp_fake_ip: string;
    video_width: number;
    video_height: number;
    video_refresh_rate: number;
    audio_channel_count: number;
    client_settings: {
        run_uid: number;
        run_gid: number;
        controllers_override: any[];
        mouse_acceleration: number;
        v_scroll_acceleration: number;
        h_scroll_acceleration: number;
    };
}

interface VideoSession {
    type: "wolf::core::events::VideoSession";
    session_id: string; // Fixed: Use string to prevent precision loss
    // ... other properties
}

interface AudioSession {
    type: "wolf::core::events::AudioSession";
    session_id: string; // Fixed: Use string to prevent precision loss
    // ... other properties
}

interface PairSignalEvent {
    type: "wolf::core::events::PairSignal";
    client_ip: string;
    host_ip: string;
}

interface ResumeStreamEvent {
    type: "wolf::core::events::ResumeStreamEvent";
    session_id: string; // Fixed: Use string to prevent precision loss
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
    session_id: string; // Fixed: Use string to prevent precision loss
}

interface StartRunnerEvent {
    type: "wolf::core::events::StartRunner";
    runner_id: string;
    app_id: string;
    session_id?: string; // Fixed: Use string to prevent precision loss
}

interface RTPVideoPingEvent {
    type: "wolf::core::events::RTPVideoPingEvent";
    session_id?: string; // Fixed: Use string to prevent precision loss
    client_ip?: string;
    client_port?: number;
    payload?: number[];
    ping_payload?: number[]; // Legacy field name
}

interface RTPAudioPingEvent {
    type: "wolf::core::events::RTPAudioPingEvent";
    session_id?: string; // Fixed: Use string to prevent precision loss
    client_ip?: string;
    client_port?: number;
    payload?: number[];
    ping_payload?: number[]; // Legacy field name
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
    private readonly CLIENT_STATE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds (increased from 24 hours)
    private readonly ACTIVE_SESSION_TTL = 2 * 60 * 60 * 1000; // 2 hours for active sessions
    private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // Run cleanup every hour
    private cleanupTimer: NodeJS.Timeout | null = null;
    private readonly reconnectDelay: number = 5000; // 5 seconds
    private sessionValidationTimer: NodeJS.Timeout | null = null;
    private readonly sessionValidationInterval: number = 15 * 60 * 1000; // 15 minutes (increased from 5 minutes)

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
                    // Skip logging raw data - too noisy
                    
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
                                const parsedEvent: WolfEvent = this.parseJsonWithBigIntSupport(eventData);
                                
                                // Add the event type if it wasn't in the JSON data
                                if (eventType && !parsedEvent.type) {
                                    (parsedEvent as any).type = eventType;
                                }
                                
                                logger.debug(LogComponent.WOLF_EVENTS, "Parsed Wolf SSE event", { 
                                    eventType: eventType || parsedEvent.type
                                });
                                
                                this.processEvent(parsedEvent);
                                // Reset reconnect attempts on successful data
                                this.reconnectAttempts = 0;
                            } catch (error) {
                                logger.error(LogComponent.WOLF_EVENTS, "Failed to parse SSE event JSON", error);
                            }
                        } else {
                            // Skip empty events silently
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

    /**
     * Parse JSON treating all large integers as strings to prevent precision loss
     */
    private parseJsonWithBigIntSupport(jsonString: string): any {
        // Replace any large integer values (13+ digits) with quoted strings to prevent precision loss
        // This handles session_id, client_id, and any other large integer fields from Wolf
        const processedJson = jsonString.replace(
            /"(session_id|client_id|app_id)"\s*:\s*(\d{13,})/g, 
            (_, fieldName, value) => {
                return `"${fieldName}":"${value}"`;
            }
        );
        
        return JSON.parse(processedJson);
    }

    /**
     * Converts ID values to string (should already be strings from JSON parsing)
     */
    private safeBigIntToString(value: string | number | bigint): string {
        if (typeof value === 'string') {
            return value;
        }
        
        // This should rarely happen now that we preprocess JSON
        logger.warn(LogComponent.WOLF_EVENTS, "Unexpected non-string ID value", {
            value,
            type: typeof value
        });
        
        return String(value);
    }

    /**
     * Find client ID by IP address from active sessions
     */
    private findClientIdByIP(clientIP: string): string | null {
        for (const [clientId, state] of this.clientStates) {
            if (state.session) {
                // Check any session type that has client_ip
                if ((state.session as any).client_ip === clientIP) {
                    return clientId;
                }
            }
        }
        return null;
    }

    private async processEvent(event: WolfEvent) {
        try {
            // Ensure the event has a type field
            const eventType = event.type || (event as any).eventType;
            if (!eventType) {
                logger.warn(LogComponent.WOLF_EVENTS, "Event missing type field", { event });
                return;
            }
            
            // Only log important events, not high-frequency ones
        if (!eventType.includes('RTPVideoPingEvent') && !eventType.includes('RTPAudioPingEvent')) {
            logger.debug(LogComponent.WOLF_EVENTS, `Processing event: ${eventType}`);
        }
            
            await this.processEventByType(eventType, event);
        } catch (error) {
            logger.error(LogComponent.WOLF_EVENTS, "Failed to process event", error, {
                eventType: event.type || (event as any).eventType,
                eventData: event,
                errorMessage: error instanceof Error ? error.message : String(error),
                errorStack: error instanceof Error ? error.stack : undefined
            });
            // Continue processing other events - don't let one failure break the stream
        }
    }

    private async processEventByType(eventType: string, event: WolfEvent) {
        switch (eventType) {
            case "wolf::core::events::PauseStreamEvent": {
                const pauseEvent = event as PauseStreamEvent;
                if (pauseEvent.session_id == null) {
                    logger.warn(LogComponent.WOLF_EVENTS, "PauseStreamEvent missing session_id", { event: pauseEvent });
                    break;
                }
                const pauseClientId = this.safeBigIntToString(pauseEvent.session_id);
                
                // Update database first to ensure consistency
                await this.updateClientLastSeen(pauseClientId);
                
                // Then update memory state
                this.clientStates.set(pauseClientId, {
                    ...this.clientStates.get(pauseClientId),
                    status: "Paused",
                    lastSeen: new Date(),
                });
                
                // Finally emit the event
                this.emit("CLIENT_UPDATE", { clientId: pauseClientId, status: "Paused" });
                break;
            }
            case "wolf::core::events::StopStreamEvent": {
                const stopEvent = event as StopStreamEvent;
                if (stopEvent.session_id == null) {
                    logger.warn(LogComponent.WOLF_EVENTS, "StopStreamEvent missing session_id", { event: stopEvent });
                    break;
                }
                const stopClientId = this.safeBigIntToString(stopEvent.session_id);
                
                logger.info(LogComponent.WOLF_EVENTS, "Client going offline", {
                    clientId: stopClientId
                });
                
                // Update database first to ensure consistency
                await this.updateClientLastSeen(stopClientId);
                
                // Then update memory state
                this.clientStates.set(stopClientId, {
                    status: "Offline",
                    session: undefined,
                    lastSeen: new Date(),
                });
                
                // Emit offline status update
                this.emit("CLIENT_UPDATE", { clientId: stopClientId, status: "Offline" });
                break;
            }
            case "wolf::core::events::StreamSession": {
                const streamEvent = event as StreamSession;
                if (!streamEvent.client_id) {
                    logger.warn(LogComponent.WOLF_EVENTS, "StreamSession missing client_id", { event: streamEvent });
                    break;
                }
                // Store session for both client_id tracking and IP mapping
                this.clientStates.set(streamEvent.client_id, { status: "Online", session: streamEvent });
                
                logger.info(LogComponent.WOLF_EVENTS, "Client session established", {
                    client_id: streamEvent.client_id,
                    client_ip: streamEvent.client_ip,
                    app_id: streamEvent.app_id
                });
                
                // Emit both SESSION_UPDATE and CLIENT_UPDATE for real-time status updates
                this.emit("SESSION_UPDATE", { ...streamEvent, clientId: streamEvent.client_id });
                this.emit("CLIENT_UPDATE", { clientId: streamEvent.client_id, status: "Online" });
                await this.updateClientLastSeen(streamEvent.client_id);
                break;
            }
            case "wolf::core::events::VideoSession":
            case "wolf::core::events::AudioSession": {
                const sessionEvent = event as VideoSession | AudioSession;
                if (sessionEvent.session_id == null) {
                    logger.warn(LogComponent.WOLF_EVENTS, `${eventType} missing session_id`, { event: sessionEvent });
                    break;
                }
                // Use BigInt for precision, then convert to string for consistency
                const sessionClientId = this.safeBigIntToString(sessionEvent.session_id);
                
                // Update existing client state or create new one, preserving IP mapping
                const existingState = this.clientStates.get(sessionClientId);
                this.clientStates.set(sessionClientId, {
                    ...existingState,
                    status: "Online",
                    session: sessionEvent
                });
                
                logger.debug(LogComponent.WOLF_EVENTS, `${eventType} updated for client`, {
                    session_id: sessionEvent.session_id,
                    client_ip: (sessionEvent as any).client_ip,
                    client_id: sessionClientId
                });
                
                // Emit both SESSION_UPDATE and CLIENT_UPDATE for real-time status updates
                this.emit("SESSION_UPDATE", { ...sessionEvent, clientId: sessionClientId });
                this.emit("CLIENT_UPDATE", { clientId: sessionClientId, status: "Online" });
                await this.updateClientLastSeen(sessionClientId);
                break;
            }
            case "wolf::core::events::ResumeStreamEvent": {
                const resumeEvent = event as ResumeStreamEvent;
                if (resumeEvent.session_id == null) {
                    logger.warn(LogComponent.WOLF_EVENTS, "ResumeStreamEvent missing session_id", { event: resumeEvent });
                    break;
                }
                const resumeClientId = this.safeBigIntToString(resumeEvent.session_id);
                
                // Update database first to ensure consistency
                await this.updateClientLastSeen(resumeClientId);
                
                // Then update memory state
                this.clientStates.set(resumeClientId, {
                    ...this.clientStates.get(resumeClientId),
                    status: "Online",
                    lastSeen: new Date(),
                });
                
                // Finally emit the event
                this.emit("CLIENT_UPDATE", { clientId: resumeClientId, status: "Online" });
                break;
            }
            case "wolf::core::events::PairSignal": {
                const pairEvent = event as PairSignalEvent;
                if (!pairEvent.client_ip || !pairEvent.host_ip) {
                    logger.warn(LogComponent.WOLF_EVENTS, "PairSignal missing required IP addresses", { event: pairEvent });
                    break;
                }
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
                if (!plugEvent.device_id || !plugEvent.device_type) {
                    logger.warn(LogComponent.WOLF_EVENTS, "PlugDeviceEvent missing required fields", { event: plugEvent });
                    break;
                }
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
                if (!unplugEvent.device_id || !unplugEvent.device_type) {
                    logger.warn(LogComponent.WOLF_EVENTS, "UnplugDeviceEvent missing required fields", { event: unplugEvent });
                    break;
                }
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
                if (idrEvent.session_id == null) {
                    logger.warn(LogComponent.WOLF_EVENTS, "IDRRequestEvent missing session_id", { event: idrEvent });
                    break;
                }
                const idrClientId = String(idrEvent.session_id);
                logger.debug(LogComponent.WOLF_EVENTS, "IDR request received", {
                    session_id: idrEvent.session_id
                });
                this.emit("IDR_REQUEST", { clientId: idrClientId, session_id: idrEvent.session_id });
                break;
            }
            case "wolf::core::events::StartRunner": {
                const runnerEvent = event as StartRunnerEvent;
                if (!runnerEvent.runner_id || !runnerEvent.app_id) {
                    logger.warn(LogComponent.WOLF_EVENTS, "StartRunner missing required fields", { event: runnerEvent });
                    break;
                }
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
                
                // RTP ping events often don't have session_id, try to find active client by IP
                let videoPingClientId: string | null = null;
                
                if (videoPingEvent.session_id != null) {
                    videoPingClientId = this.safeBigIntToString(videoPingEvent.session_id);
                } else if (videoPingEvent.client_ip) {
                    // Find active session by client IP
                    videoPingClientId = this.findClientIdByIP(videoPingEvent.client_ip);
                }
                
                if (!videoPingClientId) {
                    // Skip logging for missing ping events - too noisy
                    break;
                }
                
                // Update client last seen for ping activity (no logging)
                await this.updateClientLastSeen(videoPingClientId);
                
                this.emit("RTP_PING", {
                    clientId: videoPingClientId,
                    type: "video",
                    session_id: videoPingEvent.session_id,
                    ping_payload: videoPingEvent.ping_payload || videoPingEvent.payload
                });
                break;
            }
            case "wolf::core::events::RTPAudioPingEvent": {
                const audioPingEvent = event as RTPAudioPingEvent;
                
                // RTP ping events often don't have session_id, try to find active client by IP
                let audioPingClientId: string | null = null;
                
                if (audioPingEvent.session_id != null) {
                    audioPingClientId = this.safeBigIntToString(audioPingEvent.session_id);
                } else if (audioPingEvent.client_ip) {
                    // Find active session by client IP
                    audioPingClientId = this.findClientIdByIP(audioPingEvent.client_ip);
                }
                
                if (!audioPingClientId) {
                    // Skip logging for missing ping events - too noisy
                    break;
                }
                
                // Update client last seen for ping activity (no logging)
                await this.updateClientLastSeen(audioPingClientId);
                
                this.emit("RTP_PING", {
                    clientId: audioPingClientId,
                    type: "audio",
                    session_id: audioPingEvent.session_id,
                    ping_payload: audioPingEvent.ping_payload || audioPingEvent.payload
                });
                break;
            }
            case "PairRequest": {
                const pairReqEvent = event as PairRequestEvent;
                if (!pairReqEvent.pair_secret) {
                    logger.warn(LogComponent.WOLF_EVENTS, "PairRequest missing pair_secret", { event: pairReqEvent });
                    break;
                }
                // Add if not already present
                if (!this.pendingPairRequests.some(req => req.pair_secret === pairReqEvent.pair_secret)) {
                    this.pendingPairRequests.push(pairReqEvent);
                }
                this.emit("PAIR_REQUEST_UPDATE", this.pendingPairRequests);
                break;
            }
            case "PairRequestRemoved": {
                const pairRemovedEvent = event as PairRequestRemovedEvent;
                if (!pairRemovedEvent.pair_secret) {
                    logger.warn(LogComponent.WOLF_EVENTS, "PairRequestRemoved missing pair_secret", { event: pairRemovedEvent });
                    break;
                }
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

    // Batched database updates to improve performance
    private pendingDbUpdates = new Map<string, NodeJS.Timeout>();
    private readonly DB_UPDATE_BATCH_DELAY = 100; // Batch updates within 100ms
    
    private async updateClientLastSeen(clientId: string) {
        // Clear any existing pending update for this client
        const existingTimeout = this.pendingDbUpdates.get(clientId);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }
        
        // Batch database updates to reduce load
        const timeout = setTimeout(async () => {
            this.pendingDbUpdates.delete(clientId);
            await this.performDatabaseUpdate(clientId);
        }, this.DB_UPDATE_BATCH_DELAY);
        
        this.pendingDbUpdates.set(clientId, timeout);
    }
    
    private async performDatabaseUpdate(clientId: string) {
        try {
            const db = await getDatabase();
            const timestamp = new Date().toISOString();
            
            await (db as any).update(clientDevices).set({
                lastSeen: timestamp
            }).where(eq(clientDevices.wolfClientId, clientId));
            
            logger.debug(LogComponent.WOLF_EVENTS, "Database update completed", {
                clientId,
                timestamp
            });
            
        } catch (error) {
            logger.error(LogComponent.WOLF_EVENTS, "Database update failed", error, {
                clientId
            });
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

        logger.debug(LogComponent.WOLF_EVENTS, "Started periodic cleanup of client states");
    }

    /**
     * Clean up stale client states to prevent memory growth
     * Excludes active sessions from cleanup
     */
    private cleanupStaleClientStates(): void {
        const now = Date.now();
        let removedCount = 0;
        const statesToRemove: string[] = [];

        // Find stale entries, excluding active sessions
        for (const [clientId, state] of this.clientStates.entries()) {
            if (state.lastSeen) {
                const age = now - state.lastSeen.getTime();
                const isActiveSession = state.status === "Online" || state.status === "Paused";
                const ttlToUse = isActiveSession ? this.ACTIVE_SESSION_TTL : this.CLIENT_STATE_TTL;
                
                // Only remove if older than appropriate TTL
                if (age > ttlToUse) {
                    // Extra protection: don't remove if status is active and within grace period
                    if (!(isActiveSession && age < this.CLIENT_STATE_TTL)) {
                        statesToRemove.push(clientId);
                    }
                }
            } else {
                // Remove entries without lastSeen that are not active
                if (state.status !== "Online" && state.status !== "Paused") {
                    statesToRemove.push(clientId);
                }
            }
        }

        // Remove stale entries
        for (const clientId of statesToRemove) {
            this.clientStates.delete(clientId);
            removedCount++;
        }

        // If still over limit, remove oldest inactive entries only
        const inactiveEntries = Array.from(this.clientStates.entries())
            .filter(([_, state]) => state.status !== "Online" && state.status !== "Paused")
            .sort((a, b) => {
                const aTime = a[1].lastSeen?.getTime() || 0;
                const bTime = b[1].lastSeen?.getTime() || 0;
                return aTime - bTime; // Oldest first
            });

        let toRemoveCount = Math.max(0, this.clientStates.size - this.MAX_CLIENT_STATES);
        for (let i = 0; i < Math.min(toRemoveCount, inactiveEntries.length); i++) {
            const [clientId] = inactiveEntries[i];
            this.clientStates.delete(clientId);
            removedCount++;
        }

        if (removedCount > 0) {
            logger.info(LogComponent.WOLF_EVENTS, "Cleaned up stale client states", {
                removedCount,
                remainingCount: this.clientStates.size,
                activeSessionsProtected: true
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
        if (this.sessionValidationTimer) {
            clearInterval(this.sessionValidationTimer);
            this.sessionValidationTimer = null;
        }
        // Clear pending database updates
        for (const timeout of this.pendingDbUpdates.values()) {
            clearTimeout(timeout);
        }
        this.pendingDbUpdates.clear();
        
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