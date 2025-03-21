"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogComponent } from "@/lib/logger";
import { clientLogger } from "@/lib/logger/client";
import { showToast } from "@/lib/toast";
import { useSession } from "next-auth/react";
import { useRef, useState } from "react";
import { updateSteamSettings } from "../actions";

interface SteamSettingsFormData {
  steamId: string;
  steamApiKey: string;
}

export function SteamSettingsForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { update: updateSession } = useSession();
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData(event.currentTarget);
      const data: SteamSettingsFormData = {
        steamId: formData.get("steamId") as string,
        steamApiKey: formData.get("steamApiKey") as string,
      };

      await clientLogger.debug(LogComponent.STEAM, "Saving Steam settings", {
        steamId: data.steamId,
        hasApiKey: !!data.steamApiKey,
      });

      const result = await updateSteamSettings(data);

      if (!result.success) {
        throw new Error(result.error || "Failed to save Steam settings");
      }

      await clientLogger.info(
        LogComponent.STEAM,
        "Steam settings saved successfully"
      );
      showToast.success("Settings Saved", {
        description: "Your Steam settings have been saved successfully",
      });

      // Update session to reflect new values
      await updateSession();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      await clientLogger.error(
        LogComponent.STEAM,
        "Failed to save Steam settings",
        err
      );
      showToast.error("Save Failed", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="steamId">Steam ID</Label>
        <Input
          id="steamId"
          name="steamId"
          placeholder="Enter your Steam ID"
          disabled={isLoading}
        />
        <p className="text-sm text-muted-foreground">
          Your Steam ID can be found in your Steam profile URL
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="steamApiKey">Steam API Key</Label>
        <Input
          id="steamApiKey"
          name="steamApiKey"
          type="password"
          placeholder="Enter your Steam API Key"
          disabled={isLoading}
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
      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Saving..." : "Save Settings"}
      </Button>
    </form>
  );
}
