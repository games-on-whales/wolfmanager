"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <h2 className="text-xl font-semibold">Something went wrong!</h2>
      <p className="text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred"}
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground">
          Error Code: {error.digest}
        </p>
      )}
      <Button onClick={reset}>Try Again</Button>
    </div>
  );
}
