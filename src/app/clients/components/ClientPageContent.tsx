"use client";

import {
  getPendingPairRequestsAction,
  unpairWolfClientAction,
} from "@/app/actions/wolf-actions"; // Import Wolf API Server Actions
import { getClientsAction, pairAndAddClientAction, removeClientAction } from "@/app/clients/actions"; // Import database-backed clients action
import { Button } from "@/components/ui/button"; // Import Button
import { useToast } from "@/components/ui/use-toast";
import { type PendingPairRequest } from "@/lib/api/wolf-pair";
import { LogComponent } from "@/lib/logger";
import { clientLogger } from "@/lib/logger/client";
import { ClientDevice } from "@/types/client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState, useTransition } from "react";
import { toast as sonnerToast } from "sonner";
import PairedClientsCard from "./PairedClientsCard";
import PairingForm from "./PairingForm";
import PendingRequestsCard from "./PendingRequestsCard";

// Define a type for the client data including the optional owner and additional properties
type ClientWithOwner = ClientDevice & {
  owner?: string;
  device_type?: string;
  last_seen?: string;
  status?: string;
  pair_secret?: string; // Include pair_secret for filtering
};

interface ClientPageContentProps {
  initialRequests: PendingPairRequest[];
  initialPairedClients: ClientWithOwner[];
}

const ClientPageContent: React.FC<ClientPageContentProps> = ({
  initialRequests,
  initialPairedClients,
}) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  // State for PendingPairRequests logic
  const [requests, setRequests] =
    useState<PendingPairRequest[]>(initialRequests);
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
  const [pairedClients, setPairedClients] =
    useState<ClientWithOwner[]>(initialPairedClients);
  const [isLoadingPairedClients, setIsLoadingPairedClients] = useState(false); // Initial load handled by Server Component
  const [errorPairedClients, setErrorPairedClients] = useState<string | null>(
    null
  );
  const [unpairingId, setUnpairingId] = useState<string | null>(null);

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

      // Get paired clients using database-backed server action
      const pairedClientsResponse = await getClientsAction();
      let pairedClientsData = pairedClients; // Preserve existing clients on failure
      
      if (pairedClientsResponse.success) {
        pairedClientsData = (pairedClientsResponse.data?.clients || []).map((client: any) => ({
          id: client.id || client.client_id,
          wolf_client_id: client.wolf_client_id,
          friendly_name: client.hostname || client.friendly_name || `Client ${client.id}`,
          device_type: client.device_type || 'Unknown',
          last_seen: client.last_seen,
          status: client.status || 'Unknown',
          owner: 'Current User', // Since we're getting user-specific clients
          pair_secret: client.pair_secret,
        }));
      } else {
        // Log error but don't throw - preserve existing data
        const errorMessage = typeof pairedClientsResponse.error === 'string'
          ? pairedClientsResponse.error
          : pairedClientsResponse.error?.message || "Failed to fetch paired clients";
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

  useEffect(() => {
    // Poll every 10 seconds after initial load
    const pollInterval = setInterval(() => fetchRequests(true), 10000);

    return () => {
      clearInterval(pollInterval);
    };
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount

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
    if (!session?.user?.name || !selectedRequest) {
      const error = !session?.user?.name
        ? "You must be logged in"
        : "You must select a device to pair";
      clientLogger.error(LogComponent.PAIRING, error, new Error(error));
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
            username: session.user.name,
            friendlyName,
          }
        );

        const pairResult = await pairAndAddClientAction(
          pin,
          friendlyName,
          pairSecret
        );

        if (!pairResult.success) {
          const errorMessage = typeof pairResult.error === 'string'
            ? pairResult.error
            : pairResult.error?.message || "Failed to pair device";
          const errorCode = pairResult.error?.code;
          const errorToLog = new Error(errorMessage);

          // Handle duplicate cleanup as a warning, not an error
          if (errorCode === "CONFLICT" && errorMessage.includes("Duplicate clients were detected and removed")) {
            clientLogger.warn(
              LogComponent.PAIRING,
              "[ClientPageContent] Duplicate cleanup completed",
              { errorMessage }
            );
            
            sonnerToast.warning("Duplicate clients found and cleared", {
              description: "Duplicate pairing entries were automatically removed. Please try the pairing process again.",
            });
            
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
            clientId: pairResult.data?.client?.id,
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
    if (!session?.user?.name) {
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
        setPairedClients((prev: ClientWithOwner[]) =>
          prev.filter((client) =>
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
        const errorMessage = typeof response.error === 'string'
          ? response.error
          : response.error?.message || "Failed to unpair device";
        throw new Error(errorMessage);
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
      />
    </>
  );
};

export default ClientPageContent;
