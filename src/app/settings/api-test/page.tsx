import { ErrorBoundary } from "@/components/error-boundary";
import { PageLayout } from "@/components/layout/page-layout";
import { LoadingState } from "@/components/loading-state";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ApiTestConsole } from "./components/api-test-console";

export default async function ApiTestPage() {
  // 1. Authentication
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "admin") redirect("/dashboard");

  // 2. Render with page layout
  return (
    <PageLayout
      title="API Test"
      description="Test and verify Wolf API endpoints"
    >
      <ErrorBoundary>
        <Suspense fallback={<LoadingState />}>
          <ApiTestConsole />
        </Suspense>
      </ErrorBoundary>
    </PageLayout>
  );
}
