import { ErrorBoundary } from "@/components/error-boundary";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
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
      <div className="space-y-6 p-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-white neon-text">System Logs</h1>
        </div>
        <div className="flex flex-col h-full pb-8">
          <ErrorBoundary>
            <Suspense fallback={<LoadingState />}>
              <LogViewer initialEntries={result.entries || []} />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    );
  } catch (error) {
    throw error;
  }
}
