import { ErrorBoundary } from "@/components/error-boundary";
import { PageLayout } from "@/components/layout/page-layout";
import { LoadingState } from "@/components/loading-state";
import { authOptions } from "@/lib/auth";
import { loadConfig } from "@/lib/config";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FirstTimeWizard } from "./components/first-time-wizard";

export default async function FirstTimeSetupPage() {
  // 1. Authentication
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/auth/signin");
  }

  // If user has already completed first-time setup, redirect to dashboard
  if (session.requiresFirstTimeSetup === false) {
    redirect("/dashboard");
  }

  // If we don't have a clear indication of first-time setup status, check the user config
  const config = loadConfig();
  const user = config.users[session.user.name];

  if (!user || user.has_changed_password) {
    redirect("/dashboard");
  }

  return (
    <PageLayout
      title="Welcome to Wolf"
      description="Let's get your account set up"
    >
      <ErrorBoundary>
        <Suspense fallback={<LoadingState />}>
          <FirstTimeWizard />
        </Suspense>
      </ErrorBoundary>
    </PageLayout>
  );
}
