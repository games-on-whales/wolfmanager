"use client";

import {
  getPendingPairRequestsAction,
  unpairWolfClientAction,
} from "@/app/actions/wolf-actions"; // Import Wolf API Server Actions
import { getPairedClientsWithSettingsAction, pairAndAddClientAction, removeClientAction } from "@/app/clients/actions";
import { Button } from "@/components/ui/button"; // Import Button
import { useToast } from "@/components/ui/use-toast";
import { type PendingPairRequest } from "@/lib/api/wolf-pair";
import { LogComponent } from "@/lib/logger";
import { clientLogger } from "@/lib/logger/client";
import { ClientDevice } from "@/types/client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState, useTransition, useCallback, useRef } from "react";
import { flushSync } from "react-dom"; // FIXED: Import flushSync to prevent React batching delays
import { toast as sonnerToast } from "sonner";
import PairedClientsCard from "./PairedClientsCard";
import PairingForm from "./PairingForm";
import PendingRequestsCard from "./PendingRequestsCard";
import { Badge } from "@/components/ui/badge";
import { useWolfEvents, type WolfRelayEvent } from "@/hooks/useWolfEvents";
 
// Define a type for the client data including the optional owner and additional properties
type ClientWithOwner = ClientDevice & {
  owner?: string;
  device_type?: string;
  last_seen?: string;
  status?: string;
  pair_secret?: string; // Include pair_secret for filtering
  settings?: import("@/types/wolf").ClientSettings;
};

interface ClientPageContentProps {
  initialRequests: PendingPairRequest[];
  initialPairedClients: ClientWithOwner[];
}

const ClientPageContent: React.FC<ClientPageContentProps> = ({
  initialRequests,
  initialPairedClients,
}) => {
  const { status, data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  // State for PendingPairRequests logic
  const [requests, setRequests] = useState<PendingPairRequest[]>(initialRequests);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false); // Initial load handled by Server Component
  const [errorRequests, setErrorRequests] = useState<string | null>(null);
  const [isRefreshingRequests, setIsRefreshingRequests] = useState(false);

  // State for PairDialog logic
  const [isPairingDialogOpen, setIsPairingDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] =
    useState<PendingPairRequest | null>(null);
  const [friendlyName, setFriendlyName] = useState("");
  const [pin, setPin] = useState("");
  const [isPairingPending, startPairingTransition] = useTransition();
  const [isPairingDevice, setIsPairingDevice] = useState(false); // Use isPairingPending instead

  // State for PairedClients logic
  const [pairedClients, setPairedClients] = useState<ClientWithOwner[]>(initialPairedClients);
  const [isLoadingPairedClients, setIsLoadingPairedClients] = useState(false); // Initial load handled by Server Component
  const [errorPairedClients, setErrorPairedClients] = useState<string | null>(
    null
  );
  const [unpairingId, setUnpairingId] = useState<string | null>(null);
  
  // SSE connection now managed by useWolfEvents hook (Phase 1 migration)
  // sseConnected derived from wolfEventsStatus
 
  // Client-side authentication check (still needed for client-side navigation)
  useEffect(() => {
    if (status === "unauthenticated") {
      clientLogger.debug(
        LogComponent.WOLF_UI,
        "Redirecting unauthenticated user to login (client-side)"
      );
      router.push(`/login?callbackUrl=/clients`);
    }
    // Do NOT redirect if status is "loading"
  }, [status, session, router]);

  // --- Logic for fetching sessions and initial status ---
  const fetchSessionsAndUpdateStatus = async () => {
    try {
      clientLogger.info(
        LogComponent.CLIENT,
        "Fetching Wolf sessions for initial status"
      );

      // Fetch active sessions from Wolf API
      const response = await fetch("/api/wolf/sessions", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Sessions API error: ${response.status}`);
      }

      const sessionsData = await response.json();
      const activeSessions = sessionsData.sessions || [];

      clientLogger.debug(
        LogComponent.CLIENT,
        "Received Wolf sessions data",
        { activeSessionsCount: activeSessions.length, activeSessions }
      );

      // Extract active client IDs from sessions
      const activeClientIds = new Set(
        activeSessions.map((session: any) => session.client_id).filter(Boolean)
      );

      // Update paired clients with Online/Offline status based on active sessions
      setPairedClients((prev: ClientWithOwner[]) =>
        prev.map((client: ClientWithOwner) => {
          const isOnline = activeClientIds.has(client.wolf_client_id);
          return {
            ...client,
            status: isOnline ? "Online" : "Offline",
          };
        })
      );

      clientLogger.info(
        LogComponent.CLIENT,
        "Updated client status based on active sessions",
        {
          totalClients: pairedClients.length,
          activeClientIds: Array.from(activeClientIds)
        }
      );

    } catch (error) {
      clientLogger.error(
        LogComponent.CLIENT,
        "Failed to fetch Wolf sessions for initial status",
        error instanceof Error ? error : new Error(String(error))
      );
    }
  };

  // --- Logic for fetching and refreshing data ---
  const fetchRequests = async (isBackgroundRefresh = false) => {
    try {
      setIsRefreshingRequests(true);
      
      // Only clear errors on initial load, not on background refresh
      if (!isBackgroundRefresh) {
        setErrorRequests(null);
        setErrorPairedClients(null);
      }

      // Call the new Server Action to get pending requests
      const pendingResult = await getPendingPairRequestsAction();
      let mappedRequests = requests; // Preserve existing requests on failure
      
      if (pendingResult.success) {
        const wolfPendingRequests = pendingResult.data?.requests || [];
        // Map Wolf API pending requests to match expected interface
        mappedRequests = wolfPendingRequests.map((request: any) => ({
          id: request.pair_secret, // Use pair_secret as the unique ID
          deviceType: `Device at ${request.client_ip}`, // Show client IP as device type
          timestamp: Date.now(), // Wolf API doesn't provide timestamp, use current time
          pair_secret: request.pair_secret,
        }));
      } else {
        // Log error but don't throw - preserve existing data
        const errorMessage = typeof pendingResult.error === 'string'
          ? pendingResult.error
          : pendingResult.error?.message || "Failed to fetch pending requests";
        clientLogger.warn(
          LogComponent.PAIRING,
          "Failed to fetch pending requests during background refresh",
          { error: errorMessage }
        );
        
        // Only set error state on initial load, not background refresh
        if (!isBackgroundRefresh) {
          setErrorRequests("Failed to load pending requests");
        }
      }

      // Get paired clients using database-backed server action with settings
      const pairedClientsResponse = await getPairedClientsWithSettingsAction();
      let pairedClientsData = pairedClients; // Preserve existing clients on failure
      
      if (pairedClientsResponse.success) {
        pairedClientsData = (pairedClientsResponse.data?.clients || []).map((client: any) => ({
          id: client.id || client.client_id,
          wolf_client_id: client.wolf_client_id || client.wolfClientId,
          friendly_name: client.friendly_name || client.friendlyName,
          device_type: client.device_type || 'Unknown',
          last_seen: client.last_seen || client.lastSeen,
          status: client.status || 'Offline', // Default to Offline instead of Unknown
          owner: client.owner || 'Current User',
          pair_secret: client.pair_secret || client.pairSecret,
          settings: client.settings,
        }));
      } else {
        // Log error but don't throw - preserve existing data
        const errorMessage = typeof pairedClientsResponse.error === 'string'
          ? pairedClientsResponse.error
          : pairedClientsResponse.error || "Failed to fetch paired clients";
        clientLogger.warn(
          LogComponent.CLIENT,
          "Failed to fetch paired clients during background refresh",
          { error: errorMessage }
        );
        
        // Only set error state on initial load, not background refresh
        if (!isBackgroundRefresh) {
          setErrorPairedClients("Failed to load paired clients");
        }
      }
// Update state with either new data or preserved existing data
setRequests(mappedRequests);
setPairedClients(pairedClientsData);

// Fetch sessions to set initial Online/Offline status (only on initial load)
if (!isBackgroundRefresh) {
  await fetchSessionsAndUpdateStatus();
}

      
    } catch (error) {
      // Log the error
      clientLogger.error(
        LogComponent.PAIRING,
        isBackgroundRefresh
          ? "Error during background refresh - preserving existing data"
          : "Error fetching pending requests or paired clients",
        error instanceof Error ? error : new Error(String(error))
      );
      
      // Only show error UI and clear data on initial load failures
      if (!isBackgroundRefresh) {
        setErrorRequests("Failed to load pending requests");
        setErrorPairedClients("Failed to load paired clients");
        sonnerToast.error("Failed to load data", {
          description: "Please try refreshing the page.",
        });
      } else {
        // For background refresh failures, just log silently and preserve existing data
        clientLogger.warn(
          LogComponent.PAIRING,
          "Background refresh failed, preserving existing client data"
        );
      }
    } finally {
      setIsRefreshingRequests(false);
    }
  };

  // Phase 1 SSE Relay: migrated from direct EventSource to useWolfEvents
  // Keep a ref to always call the latest fetchRequests inside stable onEvent
  const fetchRequestsRef = useRef(fetchRequests);
  useEffect(() => {
    fetchRequestsRef.current = fetchRequests;
  }, [fetchRequests]);

  const onEvent = useCallback((evt: WolfRelayEvent) => {
    if (!evt || !evt.event) return;
    try {
      switch (evt.event) {
        case "CLIENT_UPDATE": {
          const data = evt.data;
          // Runtime type guard
            if (
              !data ||
              typeof data !== "object" ||
              typeof (data as any).clientId !== "string" ||
              typeof (data as any).status !== "string"
            ) {
              clientLogger.warn(
                LogComponent.CLIENT,
                "Ignoring CLIENT_UPDATE with invalid payload",
                { raw: data }
              );
              return;
            }
            const clientId = (data as any).clientId as string;
            const newStatus = (data as any).status as string;
          flushSync(() => {
            setPairedClients((prev: ClientWithOwner[]) => {
              const updated = prev.map((client: ClientWithOwner) => {
                if (client.wolf_client_id === clientId) {
                  const updatedClient = {
                    ...client,
                    status: newStatus,
                    last_seen: new Date().toISOString(),
                  };
                  if (client.status !== newStatus) {
                    clientLogger.info(
                      LogComponent.CLIENT,
                      "Updated client status via SSE",
                      {
                        clientId,
                        friendlyName: client.friendly_name,
                        oldStatus: client.status,
                        newStatus
                      }
                    );
                  }
                  return updatedClient;
                }
                return client;
              });
              return [...updated];
            });
          });
          break;
        }
        case "SESSION_UPDATE": {
          const data = evt.data;
          if (
            !data ||
            typeof data !== "object" ||
            typeof (data as any).clientId !== "string"
          ) {
            clientLogger.warn(
              LogComponent.CLIENT,
              "Ignoring SESSION_UPDATE with invalid payload",
              { raw: data }
            );
            return;
          }
          clientLogger.info(
            LogComponent.CLIENT,
            "Received SESSION_UPDATE event - processing immediately",
            data
          );
          const clientId = (data as any).clientId as string;
          setPairedClients((prev: ClientWithOwner[]) => {
            const updated = prev.map((client: ClientWithOwner) => {
              if (client.wolf_client_id === clientId) {
                const updatedClient = {
                  ...client,
                  session: data,
                  status: "Online",
                  last_seen: new Date().toISOString(),
                };
                clientLogger.debug(
                  LogComponent.CLIENT,
                  "Updated client session via SSE",
                  {
                    clientId,
                    sessionType: (data as any).type,
                    updatedClient,
                  }
                );
                return updatedClient;
              }
              return client;
            });
            return [...updated];
          });
          break;
        }
        case "PAIR_REQUEST_UPDATE": {
          const data = evt.data;
          clientLogger.info(
            LogComponent.PAIRING,
            "Received PAIR_REQUEST_UPDATE event - triggering refresh",
            data
          );
          fetchRequestsRef.current(true);
          break;
        }
        default:
          break;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (evt.event === "CLIENT_UPDATE") {
        clientLogger.error(
          LogComponent.CLIENT,
          "Failed to process CLIENT_UPDATE event",
          err
        );
      } else if (evt.event === "SESSION_UPDATE") {
        clientLogger.error(
          LogComponent.CLIENT,
          "Failed to process SESSION_UPDATE event",
          err
        );
      } else if (evt.event === "PAIR_REQUEST_UPDATE") {
        clientLogger.error(
          LogComponent.PAIRING,
          "Failed to process PAIR_REQUEST_UPDATE event",
          err
        );
      }
    }
  }, []);

  const { status: wolfEventsStatus } = useWolfEvents({ onEvent });
  // Derived convenience flags + UI mapping
  const sseConnected = wolfEventsStatus === "open";
  const sseStatusLabelMap: Record<string, string> = {
    open: "Live",
    reconnecting: "Reconnecting...",
    connecting: "Connecting...",
    idle: "Idle",
    closed: "Disconnected",
  };
  const sseStatusLabel = sseStatusLabelMap[wolfEventsStatus] || wolfEventsStatus;
  const sseDotClass =
    wolfEventsStatus === "open"
      ? "bg-green-500 animate-pulse"
      : wolfEventsStatus === "reconnecting"
      ? "bg-amber-500 animate-pulse"
      : wolfEventsStatus === "connecting"
      ? "bg-blue-500 animate-pulse"
      : "bg-gray-500";

  // Fetch initial session state to set Online/Offline status (previously done when SSE connected)
  useEffect(() => {
    if (status === "authenticated" && session) {
      fetchSessionsAndUpdateStatus();
    }
  }, [status, session]);

  /* Legacy SSE cleanup logic removed (migrated to useWolfEvents) */

  // Manual refresh for paired clients as fallback
  useEffect(() => {
    // Only poll paired clients, not pending requests
    const pollInterval = setInterval(() => {
      fetchPairedClientsOnly();
    }, 30000); // Poll every 30 seconds as fallback

    return () => {
      clearInterval(pollInterval);
    };
  }, []);

  // Fetch only paired clients (for manual refresh)
  const fetchPairedClientsOnly = async () => {
    try {
      const pairedClientsResponse = await getPairedClientsWithSettingsAction();
      if (pairedClientsResponse.success) {
        const pairedClientsData = (pairedClientsResponse.data?.clients || []).map((client: any) => ({
          id: client.id || client.client_id,
          wolf_client_id: client.wolf_client_id || client.wolfClientId,
          friendly_name: client.friendly_name || client.friendlyName,
          device_type: client.device_type || 'Unknown',
          last_seen: client.last_seen || client.lastSeen,
          status: client.status || 'Offline', // Default to Offline instead of Unknown
          owner: client.owner || 'Current User',
          pair_secret: client.pair_secret || client.pairSecret,
          settings: client.settings,
        }));
        setPairedClients(pairedClientsData);
      }
    } catch (error) {
      clientLogger.error(
        LogComponent.CLIENT,
        "Failed to fetch paired clients",
        error instanceof Error ? error : new Error(String(error))
      );
    }
  };

  const handleSelectRequest = (request: PendingPairRequest) => {
    clientLogger.info(
      LogComponent.PAIRING,
      "[ClientPageContent] Selected pairing request",
      {
        requestId: request.id,
        deviceType: request.deviceType,
      }
    );
    setSelectedRequest(request);
    setIsPairingDialogOpen(true);
  };

  const handleCancelPairing = () => {
    setSelectedRequest(null);
    setPin("");
    setFriendlyName("");
    setIsPairingDialogOpen(false);
  };

  const handleSubmitPairing = async (
    friendlyName: string,
    pin: string,
    pairSecret: string
  ) => {
    // Debug session structure
    clientLogger.debug(LogComponent.PAIRING, "Session validation debug", {
      hasSession: !!session,
      sessionStatus: status,
      sessionKeys: session ? Object.keys(session) : [],
      sessionUser: session?.user,
      sessionUserName: session?.user?.name,
      sessionType: typeof session,
      sessionValue: session
    });

    // More robust session validation - check for authentication status first
    const isAuthenticated = status === "authenticated" && session;
    // Accept session if authenticated, regardless of user object structure
    // The server-side session will have the correct user information
    const hasValidSession = isAuthenticated && (session?.user?.name || (session as any)?.valid);
    
    if (!hasValidSession || !selectedRequest) {
      const error = !hasValidSession
        ? "You must be logged in"
        : "You must select a device to pair";
      clientLogger.error(LogComponent.PAIRING, error, new Error(error), {
        isAuthenticated,
        hasValidSession,
        hasSelectedRequest: !!selectedRequest,
        sessionStatus: status,
        sessionStructure: session
      });
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
      return;
    }

    startPairingTransition(async () => {
      try {
        clientLogger.debug(
          LogComponent.PAIRING,
          "[ClientPageContent] Starting pairing process",
          {
            username: session?.user?.name || "authenticated-user",
            friendlyName,
            sessionType: typeof session,
          }
        );

        // DIAGNOSTIC LOGGING: Log form data being sent to server action
        const pairingDataForAction = {
          pair_secret: pairSecret,
          pin: pin,
          friendlyName: friendlyName,
        };
        
        console.log('ClientPageContent: Form data being sent to pairAndAddClientAction', {
          pairingDataForAction,
          friendlyName: friendlyName,
          pin: pin,
          pairSecretLength: pairSecret?.length || 0,
          friendlyNameType: typeof friendlyName,
          pinType: typeof pin,
          friendlyNameLength: friendlyName?.length || 0,
          pinLength: pin?.length || 0
        });

        const pairResult = await pairAndAddClientAction(pairingDataForAction);

        if (!pairResult.success) {
          const errorMessage = typeof pairResult.error === 'string'
            ? pairResult.error
            : pairResult.error || "Failed to pair device";
          const errorCode = "UNKNOWN_ERROR"; // Default error code
          const errorToLog = new Error(errorMessage);

          // Handle all duplicate cleanup scenarios as warnings, not errors
          if (errorMessage.includes("Duplicate clients detected")) {
            clientLogger.warn(
              LogComponent.PAIRING,
              "[ClientPageContent] Duplicate cleanup process completed",
              { errorMessage }
            );
            
            // Show appropriate message based on cleanup result
            if (errorMessage.includes("removed successfully")) {
              sonnerToast.warning("Duplicate clients found and cleanup performed", {
                description: "Duplicate clients were detected and successfully removed. Please try pairing again.",
              });
            } else if (errorMessage.includes("cleanup failed")) {
              sonnerToast.warning("Duplicate clients found but cleanup failed", {
                description: "Duplicate clients detected but could not be cleaned up. Please check Wolf API connectivity and try again.",
              });
            } else {
              sonnerToast.warning("Duplicate clients found and cleanup was attempted", {
                description: "Duplicate clients were detected and cleanup was performed. Please try the pairing process again.",
              });
            }
            
            // Reset form and close dialog for retry
            handleCancelPairing();
            fetchRequests(false); // Refresh lists after cleanup
            return;
          }

          clientLogger.error(
            LogComponent.PAIRING,
            "[ClientPageContent] Pairing failed",
            errorToLog,
            { errorCode }
          );

          throw new Error(errorMessage);
        }

        clientLogger.info(
          LogComponent.PAIRING,
          "[ClientPageContent] Pairing successful",
          {
            clientId: pairResult.data?.clientId,
          }
        );
        sonnerToast.success("Device paired successfully");

        // Reset form and close dialog
        handleCancelPairing();
        fetchRequests(false); // Refresh lists after pairing
      } catch (error) {
        clientLogger.error(
          LogComponent.PAIRING,
          "[ClientPageContent] Error in pairing process",
          error instanceof Error ? error : new Error(String(error))
        );
        toast({
          title: "Error",
          description:
            error instanceof Error
              ? error.message
              : "An error occurred during pairing",
          variant: "destructive",
        });
      }
    });
  };

  const handleUnpair = async (deviceId: string) => {
    // Check authentication status instead of session structure
    if (status !== "authenticated" || !session) {
      clientLogger.warn(
        LogComponent.PAIRING,
        "Unpair attempt failed: User not authenticated"
      );
      sonnerToast.error("Authentication Required", {
        description: "You must be logged in to unpair devices.",
      });
      return;
    }

    try {
      setUnpairingId(deviceId);
      // Use removeClientAction which now handles Wolf client ID properly
      const response = await removeClientAction(deviceId);

      if (response.success) {
        // Filter by Wolf client ID OR database ID since we might be receiving either
        setPairedClients((prev) =>
          prev.filter(
            (client) =>
              client.wolf_client_id !== deviceId && client.id !== deviceId
          )
        );
        clientLogger.info(
          LogComponent.PAIRING,
          "Device unpaired successfully",
          { deviceId }
        );
        sonnerToast.success("Device unpaired successfully");
      } else {
        throw new Error(response.error || "Failed to unpair device");
      }
    } catch (error) {
      clientLogger.error(
        LogComponent.PAIRING,
        "Failed to unpair device",
        error instanceof Error ? error : new Error(String(error)),
        { deviceId }
      );
      sonnerToast.error("Failed to unpair device", {
        description: "Please try again.",
      });
    } finally {
      setUnpairingId(null);
    }
  };


  // Render loading/error states based on combined loading/error states
  if (isLoadingRequests || isLoadingPairedClients) {
    return (
      <div className="space-y-6">
        {/* Title is in the Server Component, so we don't render it here */}
        {/* <h1 className="text-2xl font-bold text-white neon-text">Clients</h1> */}
        <div className="glass-card border-none p-6">
          <h2 className="text-white text-xl">Loading Clients...</h2>
          <p className="text-gray-400">
            Please wait while we fetch your paired clients and pending requests.
          </p>
        </div>
      </div>
    );
  }

  if (errorRequests || errorPairedClients) {
    return (
      <div className="space-y-6">
        {/* Title is in the Server Component */}
        {/* <h1 className="text-2xl font-bold text-white neon-text">Clients</h1> */}
        <div className="glass-card border-none p-6">
          <h2 className="text-white text-xl">Error Loading Clients</h2>
          <p className="text-gray-400">{errorRequests || errorPairedClients}</p>
          <Button onClick={() => fetchRequests(false)} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* SSE Connection Status */}
      <div className="flex justify-end mb-4">
        <Badge
          variant={sseConnected ? "default" : "secondary"}
          className="flex items-center gap-2"
          data-testid="sse-status"
        >
          <div className={`w-2 h-2 rounded-full ${sseDotClass}`} />
          Real-time: {sseStatusLabel}
        </Badge>
      </div>

      <div
        className={`grid gap-6 transition-all duration-500 ease-in-out ${
          selectedRequest ? "md:grid-cols-2" : "grid-cols-1"
        }`}
      >
        {/* Pending Requests Card */}
        <PendingRequestsCard
          requests={requests}
          isLoading={isLoadingRequests}
          isRefreshing={isRefreshingRequests}
          onRefresh={() => fetchRequests(false)}
          onSelectRequest={handleSelectRequest}
        />

        {/* Complete Pairing Card - Slides in when needed */}
        {isPairingDialogOpen && selectedRequest && (
          <PairingForm
            selectedRequest={selectedRequest}
            onCancel={handleCancelPairing}
            onSubmit={handleSubmitPairing}
            isPairing={isPairingPending}
          />
        )}
      </div>

      {/* Paired Clients Card */}
      <PairedClientsCard
        pairedClients={pairedClients}
        isLoading={isLoadingPairedClients}
        unpairingId={unpairingId}
        onUnpair={handleUnpair}
        onEditSuccess={() => fetchRequests(true)}
      />
    </>
  );
};

export default ClientPageContent;
