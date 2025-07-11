"use server";
import { getServerSession } from "next-auth/next";
import { LogComponent, logger } from "@/lib/logger";
let SocketService: typeof import("@/lib/services/socket-service").SocketService | null = null;

async function getSocketService() {
    if (!SocketService && typeof window === "undefined") {
        const module = await import("@/lib/services/socket-service");
        SocketService = module.SocketService;
    }
    return SocketService;
}
import { authOptions } from "@/lib/auth";

// Action to get pending requests
import { WolfEventService } from "@/lib/services/wolf-event.service";

export async function getPendingRequestsAction(): Promise<any[]> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] No session for pending requests action"
      );
      return [];
    }

    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] Attempting to fetch pending requests from cache",
      { userId: session.user.id }
    );

    const cachedRequests = WolfEventService.getInstance().getPendingPairRequests();
    if (cachedRequests.length > 0) {
      logger.info(
        LogComponent.WOLF_UI,
        "[Action] Cache hit for pending requests",
        { userId: session.user.id, requestCount: cachedRequests.length }
      );
      return cachedRequests;
    }

    logger.warn(
      LogComponent.WOLF_UI,
      "[Action] Cache miss for pending requests, falling back to API",
      { userId: session.user.id }
    );

    const socketService = (await getSocketService())?.getInstance();
    if (!socketService) {
        throw new Error("SocketService is not initialized. Ensure it is called in a server-side context.");
    }
    const response = await socketService.callWolfApi(session, "/requests", {
      method: "GET",
    });

    if (!response.success) {
      logger.error(
        LogComponent.WOLF_UI,
        "[Action] Failed to fetch pending requests from API",
        new Error(response.error || "Unknown error"),
        { userId: session.user.id }
      );
      return [];
    }

    logger.info(
      LogComponent.WOLF_UI,
      "[Action] Successfully fetched pending requests from API",
      { userId: session.user.id, requestCount: (response.data as any[]).length }
    );

    return response.data as any[];
  } catch (error) {
    logger.error(
      LogComponent.WOLF_UI,
      "[Action] Error fetching pending requests",
      error instanceof Error ? error : new Error(String(error))
    );
    return [];
  }
}