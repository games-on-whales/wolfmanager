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
    redirect("/login");
  }

  // If user has already completed first-time setup, redirect to clients
  if (session.requiresFirstTimeSetup === false) {
    redirect("/clients");
  }


  return (
    <div className="space-y-6 p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-white neon-text">
        Account Setup
      </h1>
      <ErrorBoundary>
        <Suspense fallback={<LoadingState />}>
          <FirstTimeWizard />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
