import { ErrorBoundary } from "@/components/error-boundary";
import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { authOptions } from "@/lib/auth";
import { ArrowLeft } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import ApiTestConsoleServer from "./components/api-test-console-server";

export default async function ApiTestPage() {
  // 1. Authentication
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "admin") redirect("/dashboard");

  // 2. Render with standardized container layout
  return (
    <div className="space-y-6 p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-white neon-text">API Test Console</h1>
      </div>
      <p className="text-gray-400">
        Test Wolf, Steam, and System API endpoints with authentication.
      </p>
      <ErrorBoundary>
        <Suspense fallback={<LoadingState />}>
          <ApiTestConsoleServer />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
