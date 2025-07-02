import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { WolfEventService } from "@/lib/services/wolf-event.service";
import { logger, LogComponent } from "@/lib/logger";
import { getDatabase } from "@/lib/db";
import { databaseConfig } from "@/lib/db/config";
import { clientDevicesSqlite, clientDevicesPostgres, clientDevicesMysql } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const clientDevices = databaseConfig.type === 'sqlite' ? clientDevicesSqlite : databaseConfig.type === 'postgresql' ? clientDevicesPostgres : clientDevicesMysql;

async function getUserClientIds(userId: string): Promise<string[]> {
    const db = await getDatabase();
    const userClients = await (db as any).select({ wolfClientId: clientDevices.wolfClientId }).from(clientDevices).where(eq(clientDevices.userId, userId));
    return userClients.map((c: { wolfClientId: string }) => c.wolfClientId);
}

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return new Response("Unauthorized", { status: 401 });
    }

    const userId = session.user.id;
    const userClientIds = await getUserClientIds(userId);

    const stream = new ReadableStream({
        async start(controller) {
            const wolfEventService = WolfEventService.getInstance();
            
            logger.info(LogComponent.API, `Starting SSE connection for user: ${userId}`, {
                wolfEventServiceInitialized: wolfEventService.getIsInitialized()
            });

            const sendEvent = (eventName: string, data: any) => {
                logger.debug(LogComponent.API, `Attempting to send SSE event: ${eventName}`, {
                    userId,
                    eventName,
                    dataKeys: data ? Object.keys(data) : [],
                    hasClientId: data && 'clientId' in data
                });
                // Enhanced security: strict validation of clientId
                if (!data || typeof data !== 'object') {
                    logger.warn(LogComponent.API, "Invalid event data received", { eventName, dataType: typeof data });
                    return;
                }

                // If event has a clientId, ensure it belongs to the user
                if ('clientId' in data) {
                    if (!data.clientId || typeof data.clientId !== 'string') {
                        logger.warn(LogComponent.API, "Invalid clientId in event", {
                            eventName,
                            clientId: data.clientId,
                            clientIdType: typeof data.clientId
                        });
                        return;
                    }
                    
                    if (!userClientIds.includes(data.clientId)) {
                        logger.debug(LogComponent.API, "Filtering out event for unauthorized client", {
                            eventName,
                            clientId: data.clientId,
                            userId
                        });
                        return;
                    }
                }
                
                // Events without clientId should not be broadcast to all users
                // They should have explicit access control
                if (!('clientId' in data) && eventName !== 'PAIR_REQUEST_UPDATE') {
                    logger.warn(LogComponent.API, "Event without clientId attempted broadcast", {
                        eventName,
                        userId,
                        dataKeys: Object.keys(data)
                    });
                    return;
                }

                controller.enqueue(`event: ${eventName}\n`);
                controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
            };

            const clientUpdateListener = (data: any) => sendEvent("CLIENT_UPDATE", data);
            const sessionUpdateListener = (data: any) => sendEvent("SESSION_UPDATE", data);
            const pairRequestListener = (data: any) => sendEvent("PAIR_REQUEST_UPDATE", data);

            // Register event listeners
            logger.debug(LogComponent.API, `Registering SSE event listeners for user: ${userId}`);
            wolfEventService.on("CLIENT_UPDATE", clientUpdateListener);
            wolfEventService.on("SESSION_UPDATE", sessionUpdateListener);
            wolfEventService.on("PAIR_REQUEST_UPDATE", pairRequestListener);
            
            logger.debug(LogComponent.API, `Event listeners registered, current listener count:`, {
                CLIENT_UPDATE: wolfEventService.listenerCount("CLIENT_UPDATE"),
                SESSION_UPDATE: wolfEventService.listenerCount("SESSION_UPDATE"),
                PAIR_REQUEST_UPDATE: wolfEventService.listenerCount("PAIR_REQUEST_UPDATE")
            });

            // Keep-alive interval
            const keepAliveInterval = setInterval(() => {
                try {
                    controller.enqueue(": keep-alive\n\n");
                } catch (error) {
                    // Controller might be closed
                    logger.debug(LogComponent.API, "Failed to send keep-alive", { userId });
                }
            }, 20000);

            // Cleanup function
            const cleanup = () => {
                clearInterval(keepAliveInterval);
                wolfEventService.removeListener("CLIENT_UPDATE", clientUpdateListener);
                wolfEventService.removeListener("SESSION_UPDATE", sessionUpdateListener);
                wolfEventService.removeListener("PAIR_REQUEST_UPDATE", pairRequestListener);
                logger.info(LogComponent.API, `SSE connection cleaned up for user: ${userId}`);
            };

            // Handle connection abort
            request.signal.addEventListener("abort", () => {
                cleanup();
                try {
                    controller.close();
                } catch (error) {
                    // Controller might already be closed
                    logger.debug(LogComponent.API, "Controller already closed", { userId });
                }
            });

            // Error handling for the stream
            try {
                // Send initial connection event
                controller.enqueue(`event: connected\n`);
                controller.enqueue(`data: {"message":"SSE connection established"}\n\n`);
                
                logger.info(LogComponent.API, `SSE connection established for user: ${userId}`);
            } catch (error) {
                logger.error(LogComponent.API, "Failed to establish SSE connection", error, { userId });
                cleanup();
                throw error;
            }
        },
        cancel() {
            // This is called when the reader cancels the stream
            logger.debug(LogComponent.API, `SSE stream cancelled for user: ${userId}`);
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}