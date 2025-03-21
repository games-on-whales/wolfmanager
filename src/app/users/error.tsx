"use client";

import { ErrorBoundary } from "@/components/error-boundary";
import { PageLayout } from "@/components/layout/page-layout";

export default function UsersError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <PageLayout
      title="User Management"
      description="An error occurred while loading users"
    >
      <ErrorBoundary
        showToast
        fallback={
          <div className="mt-4">
            <ErrorBoundary>
              <div className="text-destructive">
                {error.message || "Failed to load users"}
              </div>
            </ErrorBoundary>
          </div>
        }
      >
        {null}
      </ErrorBoundary>
    </PageLayout>
  );
}
