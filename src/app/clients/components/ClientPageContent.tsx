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
import React, { useEffect, useState, useTransition, useRef } from "react";
import { toast as sonnerToast } from "sonner";
import PairedClientsCard from "./PairedClientsCard";
import PairingForm from "./PairingForm";
import PendingRequestsCard from "./PendingRequestsCard";
import { Badge } from "@/components/ui/badge";

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
  
  // SSE connection state
  const [sseConnected, setSseConnected] = useState(false);
  const [sseRetryCount, setSseRetryCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
          status: client.status || 'Unknown',
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
          LogComponent.PAIRING,
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

  // SSE connection setup with exponential backoff
  const connectSSE = () => {
    if (!session || eventSourceRef.current) {
      clientLogger.info(
        LogComponent.PAIRING,
        "SSE connection skipped",
        { 
          hasSession: !!session, 
          hasExistingConnection: !!eventSourceRef.current,
          sessionType: typeof session
        }
      );
      return;
    }

    try {
      clientLogger.info(
        LogComponent.PAIRING,
        "Establishing SSE connection for real-time updates",
        { userId: session?.user?.id }
      );

      const eventSource = new EventSource("/api/client-events");
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        clientLogger.info(
          LogComponent.PAIRING,
          "SSE connection established successfully"
        );
        setSseConnected(true);
        setSseRetryCount(0);
      };

      eventSource.onerror = () => {
        clientLogger.error(
          LogComponent.PAIRING,
          "SSE connection error - detailed info",
          new Error(`SSE connection failed. ReadyState: ${eventSource.readyState}, URL: ${eventSource.url}`)
        );
        setSseConnected(false);
        
        // Don't close immediately, let's see the readyState
        if (eventSource.readyState === EventSource.CLOSED) {
          clientLogger.info(LogComponent.PAIRING, "EventSource is closed");
        } else if (eventSource.readyState === EventSource.CONNECTING) {
          clientLogger.info(LogComponent.PAIRING, "EventSource is still connecting, might be authentication issue");
        }
        
        eventSource.close();
        eventSourceRef.current = null;

        // Exponential backoff retry
        const retryDelay = Math.min(1000 * Math.pow(2, sseRetryCount), 30000);
        setSseRetryCount((prev) => prev + 1);

        clientLogger.info(
          LogComponent.PAIRING,
          `Retrying SSE connection in ${retryDelay}ms (attempt ${sseRetryCount + 1})`
        );

        reconnectTimeoutRef.current = setTimeout(() => {
          connectSSE();
        }, retryDelay);
      };

      // Handle CLIENT_UPDATE events
      eventSource.addEventListener("CLIENT_UPDATE", (event) => {
        try {
          const data = JSON.parse(event.data);
          clientLogger.debug(
            LogComponent.PAIRING,
            "Received CLIENT_UPDATE event",
            data
          );

          setPairedClients((prev: ClientWithOwner[]) =>
            prev.map((client: ClientWithOwner) => {
              if (client.wolf_client_id === data.clientId) {
                return {
                  ...client,
                  status: data.status,
                  last_seen: new Date().toISOString(),
                };
              }
              return client;
            })
          );
        } catch (error) {
          clientLogger.error(
            LogComponent.PAIRING,
            "Failed to process CLIENT_UPDATE event",
            error instanceof Error ? error : new Error(String(error))
          );
        }
      });

      // Handle SESSION_UPDATE events
      eventSource.addEventListener("SESSION_UPDATE", (event) => {
        try {
          const data = JSON.parse(event.data);
          clientLogger.debug(
            LogComponent.PAIRING,
            "Received SESSION_UPDATE event",
            data
          );

          setPairedClients((prev: ClientWithOwner[]) =>
            prev.map((client: ClientWithOwner) => {
              if (client.wolf_client_id === data.clientId) {
                return {
                  ...client,
                  session: data,
                };
              }
              return client;
            })
          );
        } catch (error) {
          clientLogger.error(
            LogComponent.PAIRING,
            "Failed to process SESSION_UPDATE event",
            error instanceof Error ? error : new Error(String(error))
          );
        }
      });

      // Handle PAIR_REQUEST_UPDATE events
      eventSource.addEventListener("PAIR_REQUEST_UPDATE", (event) => {
        try {
          const data = JSON.parse(event.data);
          clientLogger.info(
            LogComponent.PAIRING,
            "Received PAIR_REQUEST_UPDATE event - triggering refresh",
            data
          );

          // Fetch fresh pending requests
          fetchRequests(true);
        } catch (error) {
          clientLogger.error(
            LogComponent.PAIRING,
            "Failed to process PAIR_REQUEST_UPDATE event",
            error instanceof Error ? error : new Error(String(error))
          );
        }
      });

      // Add a catch-all event listener for debugging
      eventSource.addEventListener("message", (event) => {
        clientLogger.debug(
          LogComponent.PAIRING,
          "Received generic SSE message",
          { data: event.data, type: event.type }
        );
      });
    } catch (error) {
      clientLogger.error(
        LogComponent.PAIRING,
        "Failed to create SSE connection",
        error instanceof Error ? error : new Error(String(error))
      );
      setSseConnected(false);
    }
  };

  // Clean up SSE connection
  const disconnectSSE = () => {
    if (eventSourceRef.current) {
      clientLogger.info(
        LogComponent.PAIRING,
        "Closing SSE connection"
      );
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setSseConnected(false);
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  // Setup SSE connection when authenticated
  useEffect(() => {
    clientLogger.info(
      LogComponent.PAIRING,
      "SSE useEffect triggered",
      { 
        status, 
        hasUserId: !!(session && 'user' in session && session.user?.id), 
        userId: session && 'user' in session ? session.user?.id : undefined,
        hasExistingConnection: !!eventSourceRef.current,
        sessionObject: session,
        userObject: session && 'user' in session ? session.user : undefined,
        sessionKeys: session ? Object.keys(session) : [],
        sessionType: typeof session
      }
    );
    
    if (status === "authenticated" && session) {
      clientLogger.info(
        LogComponent.PAIRING,
        "Attempting to connect SSE",
        { userId: session && 'user' in session ? session.user?.id : undefined }
      );
      connectSSE();
    } else {
      clientLogger.info(
        LogComponent.PAIRING,
        "SSE connection conditions not met",
        { status, hasSession: !!session }
      );
    }

    return () => {
      disconnectSSE();
    };
  }, [status, session]);

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
          status: client.status || 'Unknown',
          owner: client.owner || 'Current User',
          pair_secret: client.pair_secret || client.pairSecret,
          settings: client.settings,
        }));
        setPairedClients(pairedClientsData);
      }
    } catch (error) {
      clientLogger.error(
        LogComponent.PAIRING,
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
        <Badge variant={sseConnected ? "default" : "secondary"} className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${sseConnected ? "bg-green-500" : "bg-gray-500"} ${sseConnected ? "animate-pulse" : ""}`} />
          {sseConnected ? "Real-time updates active" : "Real-time updates inactive"}
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
