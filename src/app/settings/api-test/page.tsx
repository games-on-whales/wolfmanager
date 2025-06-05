import { ErrorBoundary } from "@/components/error-boundary";
import { LoadingState } from "@/components/loading-state";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import ApiTestConsoleServer from "./components/api-test-console-server";

export default async function ApiTestPage() {
  // 1. Authentication
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "admin") redirect("/dashboard");

  // 2. Render with modern container layout (like /clients)
  return (
    <div className="relative">
      <a
        href="/settings"
        aria-label="Back to Settings"
        className="absolute left-0 top-8 ml-4 z-10 rounded-full p-2 hover:bg-zinc-800 text-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </a>
      <div className="max-w-7xl mx-auto">
        <div className="glass-card border-none p-6 space-y-6">
          <h1 className="text-2xl font-bold text-white neon-text">
            API TEST CONSOLE
          </h1>
          <p className="text-gray-400 mb-4">
            Test Wolf, Steam, and System API endpoints with authentication.
          </p>
          <ErrorBoundary>
            <Suspense fallback={<LoadingState />}>
              <ApiTestConsoleServer />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
