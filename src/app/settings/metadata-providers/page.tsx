import { SettingsLayout } from "@/app/settings/components/settings-layout"; // Import the layout
import { ErrorBoundary } from "@/components/error-boundary";
import { LoadingSpinner } from "@/components/ui/loading";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MetadataProvidersClient } from "./components/metadata-providers-client";

export default async function MetadataProvidersPage() {
  // 1. Authentication & Authorization
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/auth/signin"); // Redirect unauthenticated users
  }

  // Check if the user is an admin
  if (session.user.role !== "admin") {
    redirect("/error/forbidden"); // Redirect non-admin users
  }

  // Define navigation items for the layout sidebar
  // This assumes the section containing SteamGridDB settings will have id="steamgriddb"
  const navigation = [{ id: "steamgriddb", label: "SteamGridDB" }];

  // 2. Render page for authenticated admins using SettingsLayout
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <SettingsLayout
          title="Metadata Providers"
          description="Configure external metadata sources like SteamGridDB."
          navigation={navigation}
        >
          {/* MetadataProvidersClient will render the actual sections */}
          <MetadataProvidersClient user={session.user} /> {/* Pass user prop */}
        </SettingsLayout>
      </Suspense>
    </ErrorBoundary>
  );
}
