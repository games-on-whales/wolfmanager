"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DiagnosticResult {
  timestamp: string;
  user: string;
  tests: {
    socketFile?: {
      exists: boolean;
      path: string;
      permissions?: {
        mode: string;
        uid: number;
        gid: number;
        isSocket: boolean;
        size: number;
      };
      error?: string;
    };
    environment?: {
      nodeEnv: string;
      user: string;
      uid: number;
      gid: number;
      dockerEnv: boolean;
      remoteContainers: string;
      codespaces: string;
    };
    endpointValidation?: {
      pairPending: boolean;
      clients: boolean;
      error?: string;
    };
    wolfApiPending?: {
      success: boolean;
      response?: any;
      responseType?: string;
      error?: string;
      stack?: string;
    };
    wolfApiClients?: {
      success: boolean;
      response?: any;
      responseType?: string;
      error?: string;
      stack?: string;
    };
    rawSocketConnection?: {
      success: boolean;
      response?: any;
      error?: string;
    };
  };
}

export default function WolfConnectionDiagnosticPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/debug/wolf-connection');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (success: boolean | undefined, error?: string) => {
    if (error) {
      return <Badge variant="destructive">Error</Badge>;
    }
    if (success === undefined) {
      return <Badge variant="secondary">Unknown</Badge>;
    }
    return success ? <Badge variant="default">Pass</Badge> : <Badge variant="destructive">Fail</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Wolf Connection Diagnostics</h1>
        <p className="text-gray-400 mt-2">
          This tool helps diagnose Wolf socket connection issues that may cause the clients page to fail.
        </p>
      </div>

      <Card className="glass-card border-none">
        <CardHeader>
          <CardTitle className="text-white">Run Diagnostics</CardTitle>
          <CardDescription className="text-gray-400">
            Click the button below to test the Wolf socket connection and API endpoints.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={runDiagnostics} 
            disabled={loading}
            className="w-full"
          >
            {loading ? "Running Diagnostics..." : "Run Wolf Connection Test"}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="glass-card border-red-500/50">
          <CardHeader>
            <CardTitle className="text-red-400">Diagnostic Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-300">{error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="space-y-4">
          <Card className="glass-card border-none">
            <CardHeader>
              <CardTitle className="text-white">Diagnostic Results</CardTitle>
              <CardDescription className="text-gray-400">
                Test run at {new Date(result.timestamp).toLocaleString()} for user: {result.user}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Socket File Test */}
          <Card className="glass-card border-none">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                Socket File Test
                {getStatusBadge(!result.tests.socketFile?.error && result.tests.socketFile?.exists, result.tests.socketFile?.error)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-gray-300">Path: {result.tests.socketFile?.path}</p>
              <p className="text-gray-300">Exists: {result.tests.socketFile?.exists ? "Yes" : "No"}</p>
              {result.tests.socketFile?.permissions && (
                <div className="text-sm text-gray-400">
                  <p>Mode: {result.tests.socketFile.permissions.mode}</p>
                  <p>UID: {result.tests.socketFile.permissions.uid}</p>
                  <p>GID: {result.tests.socketFile.permissions.gid}</p>
                  <p>Is Socket: {result.tests.socketFile.permissions.isSocket ? "Yes" : "No"}</p>
                </div>
              )}
              {result.tests.socketFile?.error && (
                <p className="text-red-300">Error: {result.tests.socketFile.error}</p>
              )}
            </CardContent>
          </Card>

          {/* Environment Test */}
          <Card className="glass-card border-none">
            <CardHeader>
              <CardTitle className="text-white">Environment Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-sm">
              <p className="text-gray-300">Node ENV: {result.tests.environment?.nodeEnv}</p>
              <p className="text-gray-300">User: {result.tests.environment?.user}</p>
              <p className="text-gray-300">UID: {result.tests.environment?.uid}</p>
              <p className="text-gray-300">GID: {result.tests.environment?.gid}</p>
              <p className="text-gray-300">Docker Env: {result.tests.environment?.dockerEnv ? "Yes" : "No"}</p>
              <p className="text-gray-300">Remote Containers: {result.tests.environment?.remoteContainers || "No"}</p>
            </CardContent>
          </Card>

          {/* Endpoint Validation Test */}
          <Card className="glass-card border-none">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                Endpoint Validation Test
                {getStatusBadge(
                  !result.tests.endpointValidation?.error && 
                  result.tests.endpointValidation?.pairPending && 
                  result.tests.endpointValidation?.clients,
                  result.tests.endpointValidation?.error
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {result.tests.endpointValidation?.error ? (
                <p className="text-red-300">Error: {result.tests.endpointValidation.error}</p>
              ) : (
                <>
                  <p className="text-gray-300">/pair/pending: {result.tests.endpointValidation?.pairPending ? "Available" : "Not Available"}</p>
                  <p className="text-gray-300">/clients: {result.tests.endpointValidation?.clients ? "Available" : "Not Available"}</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Wolf API Tests */}
          <Card className="glass-card border-none">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                Wolf API /pair/pending Test
                {getStatusBadge(result.tests.wolfApiPending?.success, result.tests.wolfApiPending?.error)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {result.tests.wolfApiPending?.success ? (
                <>
                  <p className="text-green-300">Success: API call completed</p>
                  <p className="text-gray-300">Response Type: {result.tests.wolfApiPending.responseType}</p>
                  <details className="text-xs">
                    <summary className="text-gray-400 cursor-pointer">Response Data</summary>
                    <pre className="text-gray-500 mt-2 overflow-x-auto">
                      {JSON.stringify(result.tests.wolfApiPending.response, null, 2)}
                    </pre>
                  </details>
                </>
              ) : (
                <>
                  <p className="text-red-300">Error: {result.tests.wolfApiPending?.error}</p>
                  {result.tests.wolfApiPending?.stack && (
                    <details className="text-xs">
                      <summary className="text-gray-400 cursor-pointer">Stack Trace</summary>
                      <pre className="text-gray-500 mt-2 overflow-x-auto">
                        {result.tests.wolfApiPending.stack}
                      </pre>
                    </details>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card border-none">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                Wolf API /clients Test
                {getStatusBadge(result.tests.wolfApiClients?.success, result.tests.wolfApiClients?.error)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {result.tests.wolfApiClients?.success ? (
                <>
                  <p className="text-green-300">Success: API call completed</p>
                  <p className="text-gray-300">Response Type: {result.tests.wolfApiClients.responseType}</p>
                  <details className="text-xs">
                    <summary className="text-gray-400 cursor-pointer">Response Data</summary>
                    <pre className="text-gray-500 mt-2 overflow-x-auto">
                      {JSON.stringify(result.tests.wolfApiClients.response, null, 2)}
                    </pre>
                  </details>
                </>
              ) : (
                <>
                  <p className="text-red-300">Error: {result.tests.wolfApiClients?.error}</p>
                  {result.tests.wolfApiClients?.stack && (
                    <details className="text-xs">
                      <summary className="text-gray-400 cursor-pointer">Stack Trace</summary>
                      <pre className="text-gray-500 mt-2 overflow-x-auto">
                        {result.tests.wolfApiClients.stack}
                      </pre>
                    </details>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Raw Socket Connection Test */}
          <Card className="glass-card border-none">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                Raw Socket Connection Test
                {getStatusBadge(result.tests.rawSocketConnection?.success, result.tests.rawSocketConnection?.error)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {result.tests.rawSocketConnection?.success ? (
                <>
                  <p className="text-green-300">Success: Socket connection established</p>
                  <details className="text-xs">
                    <summary className="text-gray-400 cursor-pointer">Response Data</summary>
                    <pre className="text-gray-500 mt-2 overflow-x-auto">
                      {JSON.stringify(result.tests.rawSocketConnection.response, null, 2)}
                    </pre>
                  </details>
                </>
              ) : (
                <p className="text-red-300">Error: {result.tests.rawSocketConnection?.error}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}