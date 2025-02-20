"use client";

import { SettingsLayout } from "@/components/layout/settings-layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { CheckCircleIcon, GamepadIcon } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

const navigation = [
  {
    id: "profile",
    label: "Profile Information",
  },
  {
    id: "security",
    label: "Security",
  },
  {
    id: "libraries",
    label: "Libraries",
  },
];

export default function AccountSettingsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isUpdatingSteam, setIsUpdatingSteam] = useState(false);
  const [isLoadingSteam, setIsLoadingSteam] = useState(true);
  const [hasSteamCredentials, setHasSteamCredentials] = useState(false);
  const [maskedSteamId, setMaskedSteamId] = useState("");
  const [maskedSteamApiKey, setMaskedSteamApiKey] = useState("");

  // Form states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [steamId, setSteamId] = useState("");
  const [steamApiKey, setSteamApiKey] = useState("");

  useEffect(() => {
    async function loadSteamSettings() {
      if (!session?.user?.name) return;

      try {
        const response = await fetch("/api/user/steam");
        if (!response.ok) {
          throw new Error("Failed to load Steam settings");
        }

        const data = await response.json();
        setHasSteamCredentials(data.hasSteamId && data.hasSteamApiKey);
        setMaskedSteamId(data.maskedSteamId);
        setMaskedSteamApiKey(data.maskedSteamApiKey);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load Steam settings",
        });
      } finally {
        setIsLoadingSteam(false);
      }
    }

    loadSteamSettings();
  }, [session?.user?.name, toast]);

  const handleUpdateSteam = async () => {
    if (!session?.user?.name) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "User session data is missing.",
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
          username: session.user.name,
          steamId,
          steamApiKey,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to update Steam settings");
      }

      setHasSteamCredentials(true);
      setSteamId("");
      setSteamApiKey("");

      toast({
        title: "Steam Settings Updated",
        description: "Your Steam settings have been updated successfully.",
      });
    } catch (error) {
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

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "New passwords do not match.",
      });
      return;
    }

    if (!session?.user?.name) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "User session data is missing.",
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await fetch("/api/user/password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: session.user.name,
          currentPassword,
          newPassword,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to change password");
      }

      toast({
        title: "Password Updated",
        description: "Your password has been changed successfully.",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to change password. Please verify your current password.",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <SettingsLayout
      title="Account Settings"
      description="Manage your account preferences"
      navigation={navigation}
    >
      <section id="profile">
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={session?.user?.name || ""}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                value={
                  session?.user?.role === "admin" ? "Administrator" : "User"
                }
                disabled
                className="bg-muted"
              />
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="security">
        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Change your password</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleChangePassword}
              disabled={
                isChangingPassword ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword
              }
            >
              {isChangingPassword ? "Changing Password..." : "Change Password"}
            </Button>
          </CardFooter>
        </Card>
      </section>

      <section id="libraries">
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
                {isLoadingSteam ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                ) : (
                  <>
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
                      {isUpdatingSteam
                        ? "Updating..."
                        : "Update Steam Settings"}
                    </Button>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </section>
    </SettingsLayout>
  );
}
