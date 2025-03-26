import { ErrorBoundary } from "@/components/error-boundary";
import { PageLayout } from "@/components/layout/page-layout";
import { LoadingState } from "@/components/loading-state";
import { getLogs } from "@/lib/actions/logging";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LogViewer } from "./components/log-viewer";

export default async function LogsPage() {
  // 1. Authentication
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }

  try {
    // 2. Data Fetching using server action
    const result = await getLogs();

    if (!result.success) {
      throw new Error(result.error);
    }

    // 3. Render with page layout
    return (
      <PageLayout
        title="System Logs"
        description="View and analyze system logs"
      >
        <ErrorBoundary>
          <Suspense fallback={<LoadingState />}>
            <LogViewer initialEntries={result.entries || []} />
          </Suspense>
        </ErrorBoundary>
      </PageLayout>
    );
  } catch (error) {
    throw error;
  }
}
