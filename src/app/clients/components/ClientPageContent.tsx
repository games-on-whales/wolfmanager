"use client";

import {
  getPendingRequestsAction,
  listClientsAndOwners,
  getAllPairedClientsInternal,
  pairAndAddClientAction,
  removeClientAction,
} from "@/app/clients/actions"; // Import Server Actions
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
    console.log("[DEBUG] Session on mount or refresh:", session, status);
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
  const fetchRequests = async () => {
    try {
      setIsRefreshingRequests(true);
      setErrorRequests(null);
      setErrorPairedClients(null);

      // Call the Server Action to get pending requests
      const pendingResult = await getPendingRequestsAction();

      if (!pendingResult.success || !Array.isArray(pendingResult.data)) {
        throw new Error(
          pendingResult.error?.message ||
            "Invalid response format for pending requests via action"
        );
      }
      const pendingRequests = pendingResult.data;

      // Get ALL confirmed paired clients (from all users) for filtering pending requests
      const allPairedClientsResponse = await getAllPairedClientsInternal();
      const allPairedClientsData: ClientWithOwner[] = allPairedClientsResponse.success
        ? allPairedClientsResponse.data?.clients || []
        : [];

      // Get user-specific paired clients for display
      const userPairedClientsResponse = await listClientsAndOwners();
      const userPairedClientsData: ClientWithOwner[] = userPairedClientsResponse.success
        ? userPairedClientsResponse.data?.clients || []
        : [];

      // Filter out pending requests whose pair_secret matches a secret stored for ANY paired client (from any user)
      const filteredRequests = pendingRequests.filter(
        (request: PendingPairRequest) =>
          !allPairedClientsData.some(
            (client: ClientWithOwner) =>
              client.pair_secret && client.pair_secret === request.pair_secret
          )
      );

      setRequests(filteredRequests);
      setPairedClients(userPairedClientsData); // Show only user's own paired clients
    } catch (error) {
      setErrorRequests("Failed to load pending requests");
      setErrorPairedClients("Failed to load paired clients"); // Keep setting both errors if fetch fails
      sonnerToast.error("Failed to load data", {
        description: "Please try refreshing the page.",
      });
      clientLogger.error(
        LogComponent.PAIRING,
        "Error fetching pending requests or paired clients",
        error instanceof Error ? error : new Error(String(error))
      );
    } finally {
      setIsRefreshingRequests(false);
    }
  };

  useEffect(() => {
    // Poll every 10 seconds after initial load
    const pollInterval = setInterval(fetchRequests, 10000);

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
          const errorToLog = pairResult.error
            ? new Error(pairResult.error.message)
            : new Error(
                "[ClientPageContent] Pairing failed with unknown reason"
              );
          const metadata = { errorCode: pairResult.error?.code };

          clientLogger.error(
            LogComponent.PAIRING,
            "[ClientPageContent] Pairing failed",
            errorToLog,
            metadata
          );

          throw new Error(pairResult.error?.message || "Failed to pair device");
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
        fetchRequests(); // Refresh lists after pairing
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
      const response = await removeClientAction(deviceId);

      if (response.success) {
        setPairedClients((prev: ClientWithOwner[]) =>
          prev.filter((client) => client.id !== deviceId)
        );
        clientLogger.info(
          LogComponent.PAIRING,
          "Device unpaired successfully",
          { deviceId }
        );
        sonnerToast.success("Device unpaired successfully");
      } else {
        throw new Error(response.error?.message || "Failed to unpair device");
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
          <Button onClick={fetchRequests} className="mt-4">
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
          onRefresh={fetchRequests}
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
