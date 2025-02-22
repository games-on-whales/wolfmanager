import { SettingsLayout } from "@/app/settings/components/settings-layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { LoadingState } from "@/components/loading-state";
import { authOptions } from "@/lib/auth";
import { loadConfig } from "@/lib/config";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ProfileInfo } from "./components/profile-info";
import { SecurityForm } from "./components/security-form";
import { SteamSettingsForm } from "./components/steam-settings-form";

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

async function getSteamSettings(username: string) {
  try {
    const config = loadConfig(true); // Load with decryption
    const user = config.users[username];

    if (!user) {
      return {
        hasSteamCredentials: false,
        maskedSteamId: "",
        maskedSteamApiKey: "",
      };
    }

    return {
      hasSteamCredentials: Boolean(user.steam_id && user.steam_api_key),
      maskedSteamId: user.steam_id ? maskString(user.steam_id) : "",
      maskedSteamApiKey: user.steam_api_key
        ? maskString(user.steam_api_key)
        : "",
    };
  } catch (error) {
    console.error("Error loading Steam settings:", error);
    throw error; // Let the error boundary handle it
  }
}

export default async function AccountSettingsPage() {
  // Handle authentication at the page level
  const session = await getServerSession(authOptions);

  // Redirect if not authenticated
  if (!session?.user) {
    redirect("/auth/signin");
  }

  // Get Steam settings with actual username
  const steamSettings = await getSteamSettings(session.user.name || "");

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
            <SecurityForm username={session.user.name || ""} />
          </Suspense>
        </section>
      </ErrorBoundary>

      <ErrorBoundary>
        <section id="libraries" className="mt-8">
          <Suspense fallback={<LoadingState />}>
            <SteamSettingsForm
              username={session.user.name || ""}
              initialSteamId={steamSettings.maskedSteamId}
              initialSteamApiKey={steamSettings.maskedSteamApiKey}
              initialHasSteamCredentials={steamSettings.hasSteamCredentials}
            />
          </Suspense>
        </section>
      </ErrorBoundary>
    </SettingsLayout>
  );
}
