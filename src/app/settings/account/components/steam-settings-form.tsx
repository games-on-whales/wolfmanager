"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clientLogger, LogComponent } from "@/lib/logger";
import { showToast } from "@/lib/toast";
import { useSession } from "next-auth/react";
import { useRef, useState } from "react";

interface SteamSettingsFormProps {
  steamId: string | null;
  apiKey: string | null;
}

export function SteamSettingsForm({ steamId, apiKey }: SteamSettingsFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { update: updateSession } = useSession();
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData(event.currentTarget);
      const newSteamId = formData.get("steamId") as string;
      const newApiKey = formData.get("apiKey") as string;

      clientLogger.info(LogComponent.STEAM, "Updating Steam settings");

      const response = await fetch("/api/user/steam", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          steamId: newSteamId || null,
          apiKey: newApiKey || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update Steam settings");
      }

      showToast.success("Steam Settings Updated", {
        description: "Your Steam settings have been successfully updated",
      });
      clientLogger.info(
        LogComponent.STEAM,
        "Steam settings updated successfully"
      );

      // Update session to reflect new values
      await updateSession();
    } catch (error) {
      clientLogger.error(
        LogComponent.STEAM,
        "Failed to update Steam settings",
        error
      );
      showToast.error("Steam Settings Update Failed", error as Error);
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
