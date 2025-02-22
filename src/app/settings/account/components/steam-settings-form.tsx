"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clientLogger, LogComponent } from "@/lib/logger";
import { useSession } from "next-auth/react";
import { useRef, useState } from "react";
import { toast } from "sonner";

interface SteamSettingsFormProps {
  steamId: string | null;
  apiKey: string | null;
}

export function SteamSettingsForm({ steamId, apiKey }: SteamSettingsFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { update: updateSession, data: session } = useSession();
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData(event.currentTarget);
      const steamId = formData.get("steamId") as string;
      const apiKey = formData.get("apiKey") as string;

      // Basic validation
      if (!steamId.trim() || !apiKey.trim()) {
        toast.error("Both Steam ID and API Key are required");
        setIsLoading(false);
        return;
      }

      if (!session?.user?.name) {
        toast.error("Session error: User not found");
        setIsLoading(false);
        return;
      }

      // Log the attempt (without sensitive data)
      clientLogger.info(
        LogComponent.WOLF_UI,
        "Attempting to update Steam settings"
      );

      const response = await fetch("/api/user/steam", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: session.user.name,
          steamId,
          apiKey,
        }),
      });

      const data = await response
        .json()
        .catch(() => ({ message: "Invalid server response" }));

      if (!response.ok) {
        throw new Error(data.message || "Failed to update Steam settings");
      }

      // Update session to reflect changes
      await updateSession();

      toast.success(data.message || "Steam settings updated successfully");
      clientLogger.info(
        LogComponent.WOLF_UI,
        "Steam settings updated successfully"
      );

      // Safely reset the form
      if (formRef.current) {
        formRef.current.reset();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to update Steam settings";
      clientLogger.error(
        LogComponent.WOLF_UI,
        "Failed to update Steam settings",
        { error: errorMessage }
      );
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="steamId">Steam ID</Label>
        <Input
          id="steamId"
          name="steamId"
          placeholder="Enter your Steam ID"
          required
        />
        <p className="text-sm text-muted-foreground">
          Your Steam ID can be found in your Steam profile URL
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="apiKey">Steam API Key</Label>
        <Input
          id="apiKey"
          name="apiKey"
          type="password"
          placeholder="Enter your Steam API Key"
          required
        />
        <p className="text-sm text-muted-foreground">
          Get your API key from{" "}
          <a
            href="https://steamcommunity.com/dev/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Steam Developer Portal
          </a>
        </p>
      </div>
      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? "Updating..." : "Update Steam Settings"}
      </Button>
    </form>
  );
}
