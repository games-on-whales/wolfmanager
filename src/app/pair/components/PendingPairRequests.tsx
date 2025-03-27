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
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface PendingPairRequestsProps {
  onSelectRequest: (request: PendingPairRequest) => void;
}

export function PendingPairRequests({
  onSelectRequest,
}: PendingPairRequestsProps) {
  const [requests, setRequests] = useState<PendingPairRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const pendingRequests = await wolfPairApi.getPendingRequests();
        if (!Array.isArray(pendingRequests)) {
          throw new Error("Invalid response format");
        }
        setRequests(pendingRequests);
      } catch (error) {
        setError("Failed to load pending requests");
        toast.error("Failed to load pending requests", {
          description: "Please try refreshing the page.",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequests();

    // Set up polling for new requests every 30 seconds
    const pollInterval = setInterval(fetchRequests, 30000);

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
          <Button onClick={() => window.location.reload()}>Refresh Page</Button>
        </CardContent>
      </Card>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Pending Requests</CardTitle>
          <CardDescription>
            There are no devices waiting to be paired at the moment.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Pending Pair Requests</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {requests.map((request: PendingPairRequest) => (
          <Card key={request.id}>
            <CardHeader>
              <CardTitle>{request.deviceType}</CardTitle>
              <CardDescription>
                Request received {new Date(request.timestamp).toLocaleString()}
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
    </div>
  );
}
