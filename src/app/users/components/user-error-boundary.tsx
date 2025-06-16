"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LogComponent } from "@/lib/logger";
import { clientLogger } from "@/lib/logger/client";
import { AlertTriangle, RefreshCw } from "lucide-react";
import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorId: string;
}

export class UserErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: "",
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: crypto.randomUUID(),
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.setState({
      error,
      errorInfo,
      errorId,
    });

    // Log the error with detailed information
    clientLogger.error(
      LogComponent.WOLF_UI,
      "ADMIN_TOGGLE_DEBUG: Error boundary caught error",
      error,
      {
        errorId,
        errorMessage: error.message,
        errorStack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        location: "users-management-page"
      }
    );
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: "",
    });

    clientLogger.info(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: Error boundary reset", {
      timestamp: new Date().toISOString(),
      location: "users-management-page"
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isAdminToggleError = this.state.error?.message.toLowerCase().includes('admin');
      
      return (
        <div className="p-6 space-y-4">
          <Card className="glass-card border-none p-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Users Management Error
              </CardTitle>
              <CardDescription>
                An error occurred while managing users. Error ID: {this.state.errorId}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>
                  {isAdminToggleError ? "Admin Toggle Error" : "Application Error"}
                </AlertTitle>
                <AlertDescription>
                  {this.state.error?.message || "An unexpected error occurred"}
                </AlertDescription>
              </Alert>

              {isAdminToggleError && (
                <Alert>
                  <AlertTitle>Admin Toggle Debugging</AlertTitle>
                  <AlertDescription>
                    This appears to be related to the admin toggle functionality. 
                    Check the browser console and application logs for detailed debugging information with error ID: {this.state.errorId}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <h4 className="font-semibold">Troubleshooting Steps:</h4>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li>Check browser console for detailed error logs</li>
                  <li>Verify your admin permissions</li>
                  <li>Ensure the database is accessible</li>
                  <li>Try refreshing the page</li>
                  <li>Contact administrator if the problem persists</li>
                </ul>
              </div>

              {process.env.NODE_ENV === 'development' && (
                <details className="border rounded p-2">
                  <summary className="cursor-pointer font-semibold">
                    Technical Details (Development)
                  </summary>
                  <div className="mt-2 text-xs font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded">
                    <pre>{this.state.error?.stack}</pre>
                    {this.state.errorInfo && (
                      <div className="mt-2">
                        <strong>Component Stack:</strong>
                        <pre>{this.state.errorInfo.componentStack}</pre>
                      </div>
                    )}
                  </div>
                </details>
              )}

              <div className="flex gap-2">
                <Button onClick={this.handleReset} variant="outline">
                  Try Again
                </Button>
                <Button onClick={this.handleReload} className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Reload Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}