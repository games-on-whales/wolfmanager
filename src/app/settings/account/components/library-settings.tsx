"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircleIcon, GamepadIcon } from "lucide-react";
import { SteamSettingsForm } from "./steam-settings-form";

interface LibrarySettingsProps {
  steamId: string | null;
  apiKey: string | null;
}

export function LibrarySettings({ steamId, apiKey }: LibrarySettingsProps) {
  const hasSteamCredentials = steamId || apiKey;

  if (process.env.NEXT_PUBLIC_FEATURE_GAME_LIBRARY_ENABLED !== "true") {
    return null;
  }

  return (
    <>
      <CardHeader>
        <CardTitle className="text-white text-xl">Libraries</CardTitle>
        <CardDescription>Connect your gaming accounts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
                    <li>Steam ID: {steamId}</li>
                    <li>API Key: {apiKey}</li>
                  </ul>
                  <p>Enter new values below to update them.</p>
                </AlertDescription>
              </Alert>
            )}
            <SteamSettingsForm />
          </TabsContent>
        </Tabs>
      </CardContent>
    </>
  );
}
