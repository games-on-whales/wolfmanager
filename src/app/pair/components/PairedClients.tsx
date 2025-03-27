"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClientDevice } from "@/lib/config";
import { UserService } from "@/lib/services/user-service";
import { Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function PairedClients() {
  const { data: session } = useSession();
  const [clients, setClients] = useState<ClientDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unpairingId, setUnpairingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchClients = async () => {
      if (!session?.user?.name) return;

      try {
        setIsLoading(true);
        setError(null);
        const response = await UserService.getUserClients(session.user.name);
        if (response.success && response.data) {
          setClients(response.data.clients);
        } else {
          throw new Error(response.error?.message || "Failed to load clients");
        }
      } catch (error) {
        setError("Failed to load paired clients");
        toast.error("Failed to load paired clients", {
          description: "Please try refreshing the page.",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchClients();
  }, [session?.user?.name]);

  const handleUnpair = async (deviceId: string) => {
    if (!session?.user?.name) return;

    try {
      setUnpairingId(deviceId);
      const response = await UserService.removeClientFromUser(
        session.user.name,
        deviceId
      );

      if (response.success) {
        setClients((prev) => prev.filter((client) => client.id !== deviceId));
        toast.success("Device unpaired successfully");
      } else {
        throw new Error(response.error?.message || "Failed to unpair device");
      }
    } catch (error) {
      toast.error("Failed to unpair device", {
        description: "Please try again.",
      });
    } finally {
      setUnpairingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Paired Clients...</CardTitle>
          <CardDescription>
            Please wait while we fetch your paired clients.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error Loading Clients</CardTitle>
          <CardDescription>
            {error}. Please try refreshing the page.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!clients || clients.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Paired Clients</CardTitle>
          <CardDescription>
            You haven't paired any devices yet. Use the form above to pair a new
            device.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Paired Clients</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {clients.map((client) => (
          <Card key={client.id}>
            <CardHeader>
              <CardTitle>{client.friendly_name}</CardTitle>
              <CardDescription>ID: {client.id}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleUnpair(client.id)}
                disabled={unpairingId === client.id}
              >
                {unpairingId === client.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Unpairing...
                  </>
                ) : (
                  "Unpair"
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
