"use client";

import { ErrorBoundary } from "@/components/error-boundary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading";
import { Suspense, useState } from "react";

// Custom error type for Next.js
interface NextError extends Error {
  digest?: string;
}

// Component that will throw an error in UI interaction
function BuggyCounter() {
  const [counter, setCounter] = useState(0);

  if (counter === 5) {
    throw new Error("Simulated error: Counter reached 5!");
  }

  return (
    <div className="flex items-center gap-4">
      <span>Counter: {counter}</span>
      <Button onClick={() => setCounter((count) => count + 1)}>
        Increment
      </Button>
    </div>
  );
}

// Component that will throw an error during rendering
function RenderError(): JSX.Element {
  // Using Next.js error format with error code
  const error = new Error("Simulated error: Error during render!");
  (error as any).digest = "RENDER_ERROR";

  // This will never be reached, but satisfies the JSX.Element return type
  if (true) {
    throw error;
  }
  return <div>This will never render</div>;
}

// Wrapper component to demonstrate Suspense boundary with error
function RenderErrorWithSuspense() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <RenderError />
    </Suspense>
  );
}

// Component that will throw an error in event handler
function EventError() {
  const handleClick = () => {
    throw new Error("Simulated error: Error in event handler!");
  };

  return <Button onClick={handleClick}>Trigger Event Error</Button>;
}

// Component that will throw an error in async operation
function AsyncError() {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      // Simulate an API call that fails
      await new Promise((resolve) => setTimeout(resolve, 100));
      throw new Error("Simulated error: Async operation failed!");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button onClick={handleClick} disabled={isLoading}>
      {isLoading ? "Loading..." : "Trigger Async Error"}
    </Button>
  );
}

export function ErrorBoundaryTest() {
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>UI Interaction Error</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorBoundary showToast>
            <BuggyCounter />
          </ErrorBoundary>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Render Error Test</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorBoundary showToast>
            <RenderError />
          </ErrorBoundary>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event Handler Error</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorBoundary showToast>
            <EventError />
          </ErrorBoundary>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Async Operation Error</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorBoundary showToast>
            <AsyncError />
          </ErrorBoundary>
        </CardContent>
      </Card>
    </div>
  );
}
