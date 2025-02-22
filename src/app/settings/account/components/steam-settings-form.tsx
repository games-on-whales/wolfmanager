"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clientLogger, LogComponent } from "@/lib/logger";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";

interface SteamSettingsFormProps {
  steamId: string | null;
  apiKey: string | null;
}

export function SteamSettingsForm({ steamId, apiKey }: SteamSettingsFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { update: updateSession } = useSession();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData(event.currentTarget);
      const steamId = formData.get("steamId") as string;
      const apiKey = formData.get("apiKey") as string;

      clientLogger.info(LogComponent.WOLF_UI, "Updating Steam settings");

      const response = await fetch("/api/settings/steam", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ steamId, apiKey }),
      });

      if (!response.ok) {
        throw new Error("Failed to update Steam settings");
      }

      // Update session to reflect changes
      await updateSession();

      toast.success("Steam settings updated successfully");
      clientLogger.info(
        LogComponent.WOLF_UI,
        "Steam settings updated successfully"
      );
    } catch (error) {
      clientLogger.error(
        LogComponent.WOLF_UI,
        "Failed to update Steam settings",
        error
      );
      toast.error("Failed to update Steam settings");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="steamId">Steam ID</Label>
        <Input
          id="steamId"
          name="steamId"
          defaultValue={steamId || ""}
          placeholder="Enter your Steam ID"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="apiKey">Steam API Key</Label>
        <Input
          id="apiKey"
          name="apiKey"
          type="password"
          defaultValue={apiKey || ""}
          placeholder="Enter your Steam API Key"
        />
      </div>
      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  );
}
