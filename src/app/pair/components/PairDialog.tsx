"use client";

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
import { LogComponent } from "@/lib/logger";
import { clientLogger } from "@/lib/logger/client";
import { UserService } from "@/lib/services/user-service";
import { PINSchema } from "@/lib/services/validation/pin";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PendingPairRequests } from "./PendingPairRequests";

export function PairDialog() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] =
    useState<PendingPairRequest | null>(null);
  const [friendlyName, setFriendlyName] = useState("");
  const [pin, setPin] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isPairing, setIsPairing] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSelectRequest = async (request: PendingPairRequest) => {
    clientLogger.info(
      LogComponent.PAIRING,
      "[PairDialog] Selected pairing request",
      {
        requestId: request.id,
        deviceType: request.deviceType,
      }
    );

    await clientLogger.debug(LogComponent.PAIRING, "Selected pairing request", {
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
      await clientLogger.warn(LogComponent.PAIRING, "Invalid PIN format", {
        errors: result.error.errors,
      });
    }
  };

  const handleSubmit = async (formData: FormData) => {
    if (!session?.user?.name || !selectedRequest) {
      const error = !session?.user?.name
        ? "You must be logged in"
        : "You must select a device to pair";
      // Pass a new Error object created from the message string
      await clientLogger.error(LogComponent.PAIRING, error, new Error(error));
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
      return;
    }

    setIsPairing(true);

    try {
      clientLogger.debug(
        LogComponent.PAIRING,
        "[PairDialog] Starting pairing process",
        {
          username: session.user.name,
          friendlyName,
        }
      );

      await clientLogger.debug(
        LogComponent.PAIRING,
        "Starting pairing process",
        {
          username: session.user.name,
          friendlyName,
        }
      );

      await clientLogger.debug(
        LogComponent.PAIRING,
        "Calling UserService.pairDevice"
      );

      const pairResult = await UserService.pairDevice(
        pin,
        friendlyName,
        selectedRequest.pair_secret
      );

      if (!pairResult.success) {
        // Ensure we always have an Error object to pass
        const errorToLog = pairResult.error
          ? new Error(pairResult.error.message)
          : new Error("[PairDialog] Pairing failed with unknown reason");
        const metadata = { errorCode: pairResult.error?.code };

        // Pass the guaranteed Error object as 3rd arg, metadata as 4th
        clientLogger.error(
          LogComponent.PAIRING,
          "[PairDialog] Pairing failed",
          errorToLog,
          metadata
        );

        throw new Error(pairResult.error?.message || "Failed to pair device");
      }

      const newClient = pairResult.data?.client;
      clientLogger.info(
        LogComponent.PAIRING,
        "[PairDialog] Pairing successful",
        { clientId: newClient?.id }
      );
      await clientLogger.info(LogComponent.PAIRING, "Pairing successful");
      toast({
        title: "Success",
        description: "Device paired successfully",
        variant: "default",
      });

      // Reset form and close dialog
      setPin("");
      setFriendlyName("");
      setIsOpen(false);
      router.refresh();
    } catch (error) {
      clientLogger.error(
        LogComponent.PAIRING,
        "[PairDialog] Error in pairing process",
        error instanceof Error ? error : new Error(String(error))
      );
      await clientLogger.error(
        LogComponent.PAIRING,
        "Error in pairing process",
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
    } finally {
      setIsPairing(false);
    }
  };

  return (
    <>
      <PendingPairRequests onSelectRequest={handleSelectRequest} />
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pair New Device</DialogTitle>
            <DialogDescription>
              Enter the PIN shown on your device and a friendly name to identify
              it.
            </DialogDescription>
          </DialogHeader>
          <form
            action={(formData) => {
              startTransition(async () => {
                await handleSubmit(formData);
              });
            }}
          >
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="pin">PIN</Label>
                <Input
                  id="pin"
                  name="pin"
                  value={pin}
                  onChange={(e) => handlePinChange(e.target.value)}
                  placeholder="Enter 4-digit PIN"
                  maxLength={4}
                  disabled={isPending || isPairing}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="friendlyName">Friendly Name</Label>
                <Input
                  id="friendlyName"
                  name="friendlyName"
                  value={friendlyName}
                  onChange={(e) => setFriendlyName(e.target.value)}
                  placeholder="E.g., Living Room TV"
                  disabled={isPending || isPairing}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  !pin ||
                  pin.length !== 4 ||
                  !friendlyName.trim() ||
                  isPending ||
                  isPairing
                }
              >
                {isPending || isPairing ? "Pairing..." : "Pair Device"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
