import { ErrorBoundary } from "@/components/error-boundary";
import { LoadingSpinner } from "@/components/ui/loading";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SettingsClient } from "./components/settings-client";

export default async function SettingsPage() {
  // 1. Authentication
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/auth/signin");
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <SettingsClient
          user={{
            id: session.user.id,
            name: session.user.name,
            role: session.user.role,
          }}
        />
      </Suspense>
    </ErrorBoundary>
  );
}
