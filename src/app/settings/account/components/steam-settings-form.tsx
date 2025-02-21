"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { CheckCircleIcon, GamepadIcon } from "lucide-react";
import { useState } from "react";

interface SteamSettingsFormProps {
  username: string;
  initialSteamId: string;
  initialSteamApiKey: string;
  initialHasSteamCredentials: boolean;
}

export function SteamSettingsForm({
  username,
  initialSteamId,
  initialSteamApiKey,
  initialHasSteamCredentials,
}: SteamSettingsFormProps) {
  const { toast } = useToast();
  const [isUpdatingSteam, setIsUpdatingSteam] = useState(false);
  const [hasSteamCredentials, setHasSteamCredentials] = useState(
    initialHasSteamCredentials
  );
  const [maskedSteamId, setMaskedSteamId] = useState(initialSteamId);
  const [maskedSteamApiKey, setMaskedSteamApiKey] =
    useState(initialSteamApiKey);
  const [steamId, setSteamId] = useState("");
  const [steamApiKey, setSteamApiKey] = useState("");

  const handleUpdateSteam = async () => {
    if (!steamId || !steamApiKey) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please provide both Steam ID and API Key.",
      });
      return;
    }

    setIsUpdatingSteam(true);
    try {
      const response = await fetch("/api/user/steam", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          steamId,
          steamApiKey,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to update Steam settings");
      }

      const data = await response.json();
      setHasSteamCredentials(true);
      setMaskedSteamId(data.maskedSteamId || steamId);
      setMaskedSteamApiKey(data.maskedSteamApiKey || "********");
      setSteamId("");
      setSteamApiKey("");

      toast({
        title: "Steam Settings Updated",
        description: "Your Steam settings have been updated successfully.",
      });
    } catch (error) {
      console.error("Steam update error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update Steam settings.",
      });
    } finally {
      setIsUpdatingSteam(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Game Libraries</CardTitle>
        <CardDescription>Connect your gaming accounts</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="steam" className="w-full">
          <TabsList>
            <TabsTrigger value="steam" className="flex items-center gap-2">
              <GamepadIcon className="h-4 w-4" />
              Steam
            </TabsTrigger>
          </TabsList>
          <TabsContent value="steam" className="mt-4 space-y-4">
            {hasSteamCredentials && (
              <Alert>
                <CheckCircleIcon className="h-4 w-4" />
                <AlertTitle>Steam Credentials Set</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>Your Steam credentials are configured with:</p>
                  <ul className="list-inside list-disc space-y-1">
                    <li>Steam ID: {maskedSteamId}</li>
                    <li>API Key: {maskedSteamApiKey}</li>
                  </ul>
                  <p>Enter new values below to update them.</p>
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="steam-id">Steam ID</Label>
              <Input
                id="steam-id"
                placeholder="Enter your Steam ID"
                value={steamId}
                onChange={(e) => setSteamId(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Your Steam ID can be found in your Steam profile URL
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="steam-api-key">Steam API Key</Label>
              <Input
                id="steam-api-key"
                type="password"
                placeholder="Enter your Steam API Key"
                value={steamApiKey}
                onChange={(e) => setSteamApiKey(e.target.value)}
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
            <Button
              onClick={handleUpdateSteam}
              disabled={isUpdatingSteam || !steamId || !steamApiKey}
            >
              {isUpdatingSteam ? "Updating..." : "Update Steam Settings"}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
