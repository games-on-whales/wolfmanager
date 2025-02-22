import { SettingsLayout } from "@/app/settings/components/settings-layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { LoadingState } from "@/components/loading-state";
import { authOptions } from "@/lib/auth";
import { loadConfig } from "@/lib/config";
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
  {
    id: "libraries",
    label: "Libraries",
  },
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

  // Get Steam settings directly from TOML config
  const config = loadConfig(true); // Load with decryption
  const user = config.users[session.user.name || ""];

  const steamSettings = {
    maskedSteamId: user?.steam_id ? maskString(user.steam_id) : null,
    maskedSteamApiKey: user?.steam_api_key
      ? maskString(user.steam_api_key)
      : null,
  };

  return (
    <SettingsLayout
      title="Account Settings"
      description="Manage your account preferences"
      navigation={navigation}
    >
      <ErrorBoundary>
        <section id="profile">
          <Suspense fallback={<LoadingState />}>
            <ProfileInfo user={session.user} />
          </Suspense>
        </section>
      </ErrorBoundary>

      <ErrorBoundary>
        <section id="security" className="mt-8">
          <Suspense fallback={<LoadingState />}>
            <SecurityForm />
          </Suspense>
        </section>
      </ErrorBoundary>

      <ErrorBoundary>
        <section id="libraries" className="mt-8">
          <Suspense fallback={<LoadingState />}>
            <LibrarySettings
              steamId={steamSettings.maskedSteamId}
              apiKey={steamSettings.maskedSteamApiKey}
            />
          </Suspense>
        </section>
      </ErrorBoundary>
    </SettingsLayout>
  );
}
