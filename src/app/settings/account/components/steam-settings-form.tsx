"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogComponent } from "@/lib/logger";
import { clientLogger } from "@/lib/logger/client";
import { showToast } from "@/lib/toast";
import { useSession } from "next-auth/react";
import { useRef, useState } from "react";
import { testSteamCredentials, updateSteamSettings } from "../actions";

interface SteamSettingsFormData {
  steamId: string;
  steamApiKey: string;
}

export function SteamSettingsForm() {
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const { update: updateSession } = useSession();
  const formRef = useRef<HTMLFormElement>(null);
  const [currentSteamId, setCurrentSteamId] = useState("");
  const [currentApiKey, setCurrentApiKey] = useState("");
  const [credentialsVerified, setCredentialsVerified] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);

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
      setIsSaving(false);
    }
  };

  const handleTestClick = async () => {
    if (!currentSteamId || !currentApiKey) {
      showToast.warning("Missing Fields", {
        description: "Please enter both Steam ID and API Key to test.",
      });
      return;
    }
    setIsTesting(true);
    let result: { success: boolean; isValid: boolean; error?: string } | null =
      null;
    try {
      await clientLogger.debug(
        LogComponent.STEAM,
        "Testing Steam credentials",
        {
          steamId: currentSteamId,
          hasApiKey: !!currentApiKey,
        }
      );

      result = await testSteamCredentials({
        steamId: currentSteamId,
        steamApiKey: currentApiKey,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to test credentials");
      }

      if (result.isValid) {
        await clientLogger.info(
          LogComponent.STEAM,
          "Steam credentials test successful"
        );
        showToast.success("Test Successful", {
          description: "Your Steam credentials are valid.",
        });
        setCredentialsVerified(true);
      } else {
        await clientLogger.warn(
          LogComponent.STEAM,
          "Steam credentials test failed - Invalid"
        );
        showToast.error(
          "Test Failed",
          "Your Steam credentials appear to be invalid."
        );
        setCredentialsVerified(false);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      await clientLogger.error(
        LogComponent.STEAM,
        "Failed to test Steam credentials",
        err
      );
      showToast.error("Test Error", err);
      setCredentialsVerified(false);
    } finally {
      setIsTesting(false);
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
          value={currentSteamId}
          onChange={(e) => {
            setCurrentSteamId(e.target.value);
            setCredentialsVerified(false);
          }}
          disabled={isSaving || isTesting}
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
          value={currentApiKey}
          onChange={(e) => {
            setCurrentApiKey(e.target.value);
            setCredentialsVerified(false);
          }}
          disabled={isSaving || isTesting}
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
      <div className="flex space-x-2">
        <Button
          type="submit"
          disabled={isSaving || isTesting || !credentialsVerified}
          className="flex-1 bg-[#00E5CC] hover:bg-[#00E5CC]/80 text-white"
        >
          {isSaving ? "Saving..." : "Save Settings"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleTestClick}
          disabled={isSaving || isTesting}
        >
          {isTesting ? "Testing..." : "Test Credentials"}
        </Button>
      </div>
    </form>
  );
}
