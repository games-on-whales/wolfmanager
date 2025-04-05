"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { wolfPairApi, type PendingPairRequest } from "@/lib/api/wolf-pair";
import { LogComponent } from "@/lib/logger";
import { clientLogger } from "@/lib/logger/client";
import { UserService } from "@/lib/services/user-service";
import { ClientDevice } from "@/types/client";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface PendingPairRequestsProps {
  onSelectRequest: (request: PendingPairRequest) => void;
}

// Define a type for the client data including the optional owner
type ClientWithOwner = ClientDevice & { owner?: string };

export function PendingPairRequests({
  onSelectRequest,
}: PendingPairRequestsProps) {
  const [requests, setRequests] = useState<PendingPairRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchRequests = async () => {
    try {
      setIsRefreshing(true);
      setError(null);

      // Get pending requests from Wolf API
      const pendingRequests = await wolfPairApi.getPendingRequests();
      if (!Array.isArray(pendingRequests)) {
        throw new Error("Invalid response format for pending requests");
      }

      // Get all confirmed paired clients (with owner info)
      const pairedClientsResponse = await UserService.getClientsWithOwners();
      const pairedClients: ClientWithOwner[] = pairedClientsResponse.success // Explicit type
        ? pairedClientsResponse.data?.clients || []
        : [];

      // Filter out pending requests whose pair_secret matches a secret stored for any paired client
      const filteredRequests = pendingRequests.filter(
        (request: PendingPairRequest) =>
          !pairedClients.some(
            (client: ClientWithOwner) =>
              client.pair_secret && client.pair_secret === request.pair_secret
          )
      );

      setRequests(filteredRequests);
    } catch (error) {
      setError("Failed to load pending requests");
      // Avoid duplicate toasts if polling
      if (!isLoading && !isRefreshing) {
        toast.error("Failed to load pending requests", {
          description: "Please try refreshing the page.",
        });
      }
      // Log the actual error for debugging
      await clientLogger.error(
        LogComponent.PAIRING,
        "Error fetching pending requests or paired clients",
        error instanceof Error ? error : new Error(String(error))
      );
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    // Poll every 10 seconds instead of 30
    const pollInterval = setInterval(fetchRequests, 10000);

    return () => {
      clearInterval(pollInterval);
    };
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Pending Requests...</CardTitle>
          <CardDescription>
            Please wait while we fetch pending pair requests.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error Loading Requests</CardTitle>
          <CardDescription>
            {error}. Please try refreshing the page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchRequests}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Pending Pair Requests</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchRequests}
          disabled={isRefreshing}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>
      {!requests || requests.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Pending Requests</CardTitle>
            <CardDescription>
              There are no devices waiting to be paired at the moment.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {requests.map((request: PendingPairRequest) => (
            <Card key={request.id}>
              <CardHeader>
                <CardTitle>{request.deviceType}</CardTitle>
                <CardDescription>
                  ID: {request.id}
                  <br />
                  Secret: {request.pair_secret}
                  <br />
                  Received: {new Date(request.timestamp).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  onClick={() => onSelectRequest(request)}
                >
                  Pair Device
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
