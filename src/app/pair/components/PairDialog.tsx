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
import { type PendingPairRequest } from "@/lib/api/wolf-pair";
import { UserService } from "@/lib/services/user-service";
import { Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PendingPairRequests } from "./PendingPairRequests";

export function PairDialog() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] =
    useState<PendingPairRequest | null>(null);
  const [friendlyName, setFriendlyName] = useState("");
  const [pin, setPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSelectRequest = (request: PendingPairRequest) => {
    setSelectedRequest(request);
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !session?.user?.name) return;

    setIsSubmitting(true);
    try {
      const response = await UserService.addClientToUser(
        session.user.name,
        selectedRequest.id,
        friendlyName
      );

      if (!response.success) {
        throw new Error(response.error?.message || "Failed to pair device");
      }

      toast.success(`${friendlyName} has been paired with your account.`);

      setIsOpen(false);
      setSelectedRequest(null);
      setFriendlyName("");
      setPin("");

      // Refresh the page to show updated clients
      router.refresh();
    } catch (error) {
      toast.error("Failed to pair device", {
        description: "Please check the PIN and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pin">PIN</Label>
              <Input
                id="pin"
                type="text"
                placeholder="Enter the PIN shown on your device"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
                pattern="[0-9]*"
                inputMode="numeric"
                maxLength={6}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Pairing...
                  </>
                ) : (
                  "Pair Device"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
