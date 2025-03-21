"use client";

import { PageLayout } from "@/components/layout/page-layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function UsersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageLayout
      title="User Management"
      description="An error occurred while loading users"
    >
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription className="flex flex-col gap-4">
          <p>{error.message || "Failed to load users"}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={reset}>
              Try again
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </PageLayout>
  );
}
