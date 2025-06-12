"use client";

import React, { Component, ReactNode } from "react";
import { clientLogger } from "@/lib/logger/client";
import { LogComponent } from "@/lib/logger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error asynchronously to avoid blocking
    setTimeout(async () => {
      try {
        await clientLogger.error(
          LogComponent.AUTH,
          "Authentication error boundary triggered",
          error,
          { errorInfo }
        );
      } catch (logError) {
        // Fallback if client logger fails - this is a legitimate console.error
        console.error("Failed to log auth error via client logger:", logError);
      }
    }, 0);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <h2 className="text-lg font-semibold mb-2">Authentication Error</h2>
              <p className="text-gray-600 mb-4">
                An error occurred during authentication. Redirecting to login...
              </p>
              <script
                dangerouslySetInnerHTML={{
                  __html: `
                    setTimeout(() => {
                      window.location.href = '/login';
                    }, 2000);
                  `,
                }}
              />
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}