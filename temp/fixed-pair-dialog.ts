"use client";

import { verifyPIN } from "@/app/api/pair/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { type PendingPairRequest } from "@/lib/api/wolf-pair";
import { LogComponent, logger } from "@/lib/logger";
import { UserService } from "@/lib/services/user-service";
import { PINSchema } from "@/lib/services/validation/pin";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PendingPairRequests } from "./PendingPairRequests";

export function PairDialog() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] =
    useState<PendingPairRequest | null>(null);
  const [friendlyName, setFriendlyName] = useState("");
  const [pin, setPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isPairing, setIsPairing] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSelectRequest = async (request: PendingPairRequest) => {
    console.log("[PairDialog] Selected pairing request:", {
      requestId: request.id,
      deviceType: request.deviceType,
    });
    
    await logger.debug(LogComponent.PAIRING, "Selected pairing request", {
      requestId: request.id,
      deviceType: request.deviceType,
    });
    setSelectedRequest(request);
    setIsOpen(true);
  };

  const handlePinChange = async (value: string) => {
    // Only allow digits and limit to 4 characters
    const sanitizedValue = value.replace(/[^0-9]/g, "").slice(0, 4);
    setPin(sanitizedValue);

    // Real-time format validation
    const result = PINSchema.safeParse(sanitizedValue);
    if (!result.success && sanitizedValue.length === 4) {
      await logger.warn(LogComponent.PAIRING, "Invalid PIN format", {
        errors: result.error.errors,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.name || !selectedRequest) {
      const error = !session?.user?.name
        ? "You must be logged in"
        : "You must select a device to pair";
      await logger.error(LogComponent.PAIRING, error);
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    setIsValidating(true);

    try {
      console.log("[PairDialog] Starting pairing process:", {
        username: session.user.name,
        deviceId: selectedRequest.id,
        friendlyName,
        pinLength: pin.length,
        secretPreview: selectedRequest.pair_secret.substring(0, 3) + "...",
      });

      await logger.debug(LogComponent.PAIRING, "Starting pairing process", {
        username: session.user.name,
        deviceId: selectedRequest.id,
        friendlyName,
      });

      // First validate the PIN
      await logger.debug(LogComponent.PAIRING, "Validating PIN");
      console.log("[PairDialog] About to verify PIN");
      
      try {
        const pinResult = await verifyPIN(
          pin,
          selectedRequest.id,
          selectedRequest.pair_secret
        );
        
        console.log("[PairDialog] PIN verification result:", pinResult);
        
        if (!pinResult) {
          console.error("[PairDialog] PIN validation returned false");
          throw new Error("PIN validation failed");
        }
      } catch (pinError) {
        console.error("[PairDialog] PIN verification error:", pinError);
        throw pinError; // Re-throw to be caught by the outer catch
      }
      
      console.log("[PairDialog] PIN validated successfully");
      await logger.debug(LogComponent.PAIRING, "PIN validated successfully");

      // Check if device is already paired
      await logger.debug(LogComponent.PAIRING, "Checking existing clients");
      console.log("[PairDialog] Checking existing clients");
      
      try {
        const clientsResponse = await UserService.getUserClients();
        console.log("[PairDialog] Existing clients response:", clientsResponse);
        
        if (!clientsResponse.success) {
          await logger.error(LogComponent.PAIRING, "Failed to get clients", {
            error: clientsResponse.error,
          });
          throw new Error(
            clientsResponse.error?.message || "Failed to check existing clients"
          );
        }

        const clients = clientsResponse.data?.clients || [];
        await logger.debug(LogComponent.PAIRING, "Got existing clients", {
          count: clients.length,
        });

        // Check if this device is already paired
        const existingClient = clients.find(
          (client) => client.id === selectedRequest.id
        );

        if (existingClient) {
          const error = "This device has already been paired with your account";
          await logger.warn(LogComponent.PAIRING, "Duplicate pairing attempt", {
            deviceId: selectedRequest.id,
            existingName: existingClient.friendly_name,
          });
          toast({
            title: "Already Paired",
            description: error,
            variant: "destructive",
          });
          return;
        }
      } catch (clientsError) {
        console.error("[PairDialog] Error checking existing clients:", clientsError);
        throw clientsError;
      }

      // Proceed with pairing
      setIsPairing(true);
      await logger.debug(LogComponent.PAIRING, "Adding client to user");
      console.log("[PairDialog] About to call addClientToUser:", {
        deviceId: selectedRequest.id,
        friendlyName,
      });
      
      try {
        const pairResult = await UserService.addClientToUser(
          selectedRequest.id,
          friendlyName
        );
        
        console.log("[PairDialog] addClientToUser result:", pairResult);
        
        if (!pairResult.success) {
          console.error("[PairDialog] Pairing failed:", pairResult.error);
          throw new Error(pairResult.error?.message || "Failed to pair device");
        }
      } catch (addError) {
        console.error("[PairDialog] Error in addClientToUser:", addError);
        throw addError; // Re-throw to be caught by the outer catch
      }

      console.log("[PairDialog] Pairing successful");
      await logger.info(LogComponent.PAIRING, "Pairing successful");
      toast({
        title: "Success",
        description: "Device paired successfully",
        variant: "default",
      });

      // Reset form
      setPin("");
      setFriendlyName("");
      setIsOpen(false);
      router.refresh();
    } catch (error) {
      console.error("[PairDialog] Error in pairing process:", {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        type: error && typeof error === "object" && "type" in error ? error.type : "unknown",
      });
      
      await logger.error(LogComponent.PAIRING, "Error in pairing process", {
        error: error instanceof Error ? error : new Error(String(error)),
        errorMessage: error instanceof Error ? error.message : String(error),
        errorType:
          error && typeof error === "object" && "type" in error
            ? error.type
            : "unknown",
      });

      let errorMessage = "An unknown error occurred";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === "object" && "message" in error) {
        errorMessage = String(error.message);
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
      setIsPairing(false);
      setIsSubmitting(false);
    }
  };

  // Add effect to log component mount
  useEffect(() => {
    logger.debug(LogComponent.PAIRING, "PairDialog component mounted");
    return () => {
      logger.debug(LogComponent.PAIRING, "PairDialog component unmounted");
    };
  }, []);

  return (
    <div className="space-y-6">
      <PendingPairRequests onSelectRequest={handleSelectRequest} />

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pair New Device</DialogTitle>
            <DialogDescription>
              Enter a friendly name and the PIN displayed on your device to
              complete pairing.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="friendlyName">Friendly Name</Label>
              <Input
                id="friendlyName"
                placeholder="e.g., Living Room TV"
                value={friendlyName}
                onChange={(e) => setFriendlyName(e.target.value)}
                required
                disabled={isValidating || isPairing}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="pin" className="text-sm font-medium">
                Enter 4-digit PIN
              </label>
              <Input
                id="pin"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                placeholder="Enter 4-digit PIN"
                value={pin}
                onChange={(e) => handlePinChange(e.target.value)}
                disabled={isValidating || isPairing}
                className="font-mono text-lg tracking-wider"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting || isValidating || isPairing}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  pin.length !== 4 || isSubmitting || !friendlyName.trim()
                }
                className="w-full"
              >
                {isSubmitting ? "Pairing..." : "Pair Device"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}