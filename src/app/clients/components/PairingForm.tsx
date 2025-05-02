"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type PendingPairRequest } from "@/lib/api/wolf-pair";
import { ChevronLeft, Loader2 } from "lucide-react";
import React, { useState } from "react";
import PinInput from "./pin-input"; // Import PinInput

interface PairingFormProps {
  selectedRequest: PendingPairRequest | null;
  onCancel: () => void;
  onSubmit: (
    friendlyName: string,
    pin: string,
    pairSecret: string
  ) => Promise<void>;
  isPairing: boolean;
}

const PairingForm: React.FC<PairingFormProps> = ({
  selectedRequest,
  onCancel,
  onSubmit,
  isPairing,
}) => {
  const [friendlyName, setFriendlyName] = useState("");
  const [pin, setPin] = useState("");

  const handlePinChange = (value: string) => {
    // Only allow digits and limit to 4 characters
    const sanitizedValue = value.replace(/[^0-9]/g, "").slice(0, 4);
    setPin(sanitizedValue);
  };

  const handleSubmit = async () => {
    if (selectedRequest) {
      await onSubmit(friendlyName, pin, selectedRequest.pair_secret);
    }
  };

  // Get the selected client details for the pairing dialog
  const selectedClientDetails = selectedRequest; // Use selectedRequest directly

  return (
    <div
      className={`transition-all duration-500 ease-in-out overflow-hidden ${
        selectedRequest
          ? "opacity-100 max-h-[1000px]"
          : "opacity-0 max-h-0 md:absolute md:right-0 md:top-0 md:w-1/2"
      }`}
    >
      <Card className="glass-card border-none h-full">
        <CardHeader>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="mr-2 text-gray-400 hover:text-white"
              onClick={onCancel} // Use onCancel prop
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <CardTitle className="text-white">Complete Pairing</CardTitle>
              <CardDescription className="text-gray-400">
                Enter the pairing code shown on the client device
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {selectedClientDetails && (
              <div className="rounded-md bg-[rgba(0,0,0,0.3)] p-3 text-sm mb-4">
                <p className="mb-1">
                  <span className="text-gray-400">Device Type:</span>{" "}
                  <span className="text-white">
                    {selectedClientDetails.deviceType}
                  </span>
                </p>
                <p className="mb-1">
                  <span className="text-gray-400">Pair Secret:</span>{" "}
                  <span className="text-white">
                    {selectedClientDetails.pair_secret}
                  </span>
                </p>
                <p>
                  <span className="text-gray-400">Received:</span>{" "}
                  <span className="text-white">
                    {new Date(selectedClientDetails.timestamp).toLocaleString()}
                  </span>
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="client-name" className="text-[#fffb96]">
                Client Name
              </Label>
              <Input
                id="client-name"
                placeholder="e.g. Living Room TV"
                className="bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-white neon-border"
                value={friendlyName}
                onChange={(e) => setFriendlyName(e.target.value)}
                disabled={isPairing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pin" className="text-[#fffb96]">
                Pairing PIN
              </Label>
              <div className="flex flex-col items-center">
                <PinInput
                  value={pin}
                  onChange={handlePinChange}
                  disabled={isPairing}
                  className="mb-2"
                />
                <p className="text-xs text-gray-400">
                  Enter the 4-digit PIN shown on the client device
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                className="flex-1 text-gray-400 hover:text-white"
                onClick={onCancel} // Use onCancel prop
                disabled={isPairing}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-[#00E5CC] hover:bg-[#00E5CC]/80 text-white"
                onClick={handleSubmit} // Call local handleSubmit
                disabled={
                  isPairing ||
                  !pin ||
                  pin.length !== 4 ||
                  !friendlyName ||
                  !selectedRequest // Disable if no request is selected
                }
              >
                {isPairing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Pairing...
                  </>
                ) : (
                  "Pair Device"
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PairingForm;
