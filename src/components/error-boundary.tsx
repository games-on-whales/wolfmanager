"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { clientLogger } from "@/lib/logger/client";
import { LogComponent } from "@/lib/logger/types";
import { showToast } from "@/lib/toast";
import { AlertCircle } from "lucide-react";
import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showToast?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error with component stack trace
    clientLogger.error(
      LogComponent.WOLF_UI,
      "Error boundary caught error",
      error,
      {
        componentStack: errorInfo.componentStack,
      }
    );

    // Show toast if enabled
    if (this.props.showToast) {
      showToast.error("An error occurred", error.message);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Alert variant="destructive" className="my-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription className="flex flex-col gap-4">
            <p>{this.state.error?.message || "An unexpected error occurred"}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  this.setState({ hasError: false });
                  window.location.reload();
                }}
              >
                Try again
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  window.location.href = "/";
                }}
              >
                Go to Home
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}
