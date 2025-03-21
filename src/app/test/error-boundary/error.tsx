"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Error in route:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <h2 className="text-xl font-semibold">Something went wrong!</h2>
      {error.digest && (
        <p className="text-sm text-muted-foreground">
          Error Code: {error.digest}
        </p>
      )}
      <button
        className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90"
        onClick={reset}
      >
        Try again
      </button>
    </div>
  );
}
