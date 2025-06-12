import { SettingsLayout } from "@/app/settings/components/settings-layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { LoadingState } from "@/components/loading-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { getUserByUsername } from "@/lib/db/helpers/users";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LibrarySettings } from "./components/library-settings";
import { ProfileInfo } from "./components/profile-info";
import { SecurityForm } from "./components/security-form";

const navigation = [
  {
    id: "profile",
    label: "Profile Information",
  },
  {
    id: "security",
    label: "Security",
  },
  // Conditionally include the "Libraries" link based on the feature flag
  ...(process.env.NEXT_PUBLIC_FEATURE_GAME_LIBRARY_ENABLED === "true"
    ? [
        {
          id: "libraries",
          label: "Libraries",
        },
      ]
    : []),
];

function maskString(str: string): string {
  if (!str) return "";
  const firstFour = str.slice(0, 4);
  const lastFour = str.slice(-4);
  return `${firstFour}${"*".repeat(Math.max(0, str.length - 8))}${lastFour}`;
}

export default async function AccountSettingsPage() {
  // Handle authentication at the page level
  const session = await getServerSession(authOptions);

  // Redirect if not authenticated
  if (!session?.user) {
    redirect("/auth/signin");
  }

  // Get Steam settings from database
  const user = await getUserByUsername(session.user.name || "");

  const steamSettings = {
    maskedSteamId: user?.steamId ? maskString(user.steamId) : null,
    maskedSteamApiKey: user?.steamApiKey
      ? maskString(user.steamApiKey)
      : null,
  };

  return (
    <SettingsLayout
      title="Account Settings"
      description="Manage your account preferences"
      navigation={navigation}
    >
      <div className="space-y-6">
        <ErrorBoundary>
          <Suspense fallback={<LoadingState />}>
            <ProfileInfo
              user={session.user}
              className="glass-card border-none p-6"
            />
          </Suspense>
        </ErrorBoundary>

        <ErrorBoundary>
          <Suspense fallback={<LoadingState />}>
            <SecurityForm className="glass-card border-none p-6" />
          </Suspense>
        </ErrorBoundary>

        {process.env.NEXT_PUBLIC_FEATURE_GAME_LIBRARY_ENABLED === "true" && (
          <ErrorBoundary>
            <Card className="glass-card border-none p-6">
              <CardHeader>
                <CardTitle className="text-white text-xl">Libraries</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Suspense fallback={<LoadingState />}>
                  <LibrarySettings
                    steamId={steamSettings.maskedSteamId}
                    apiKey={steamSettings.maskedSteamApiKey}
                  />
                </Suspense>
              </CardContent>
            </Card>
          </ErrorBoundary>
        )}
      </div>
    </SettingsLayout>
  );
}
