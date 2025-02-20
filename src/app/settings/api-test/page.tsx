"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useState } from "react";

interface ApiResponse {
  status: number;
  statusText: string;
  data: any;
}

export default function ApiTestPage() {
  const { toast } = useToast();

  // Available Wolf API endpoints:
  // GET  /api/wolf/clients         - List all paired clients
  // GET  /api/wolf/pair/pending    - Get pending pair requests
  // POST /api/wolf/pair            - Pair a client (requires pair_secret and pin)
  // POST /api/wolf/unpair          - Unpair a client (requires client_id)

  const [endpoint, setEndpoint] = useState("/api/wolf/clients");
  const [method, setMethod] = useState("GET");
  const [body, setBody] = useState("");
  const [responses, setResponses] = useState<ApiResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleTest = async () => {
    setIsLoading(true);
    try {
      const options: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
        },
      };

      if (method !== "GET" && body) {
        try {
          options.body = JSON.stringify(JSON.parse(body));
        } catch (e) {
          toast({
            variant: "destructive",
            title: "Invalid JSON",
            description: "Please check your request body format",
          });
          return;
        }
      }

      const response = await fetch(endpoint, options);
      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      const newResponse: ApiResponse = {
        status: response.status,
        statusText: response.statusText,
        data,
      };

      setResponses((prev) => [newResponse, ...prev]);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to test API",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container py-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">API Test</h1>
        <p className="text-muted-foreground">Test and verify API endpoints</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Test Console</CardTitle>
          <CardDescription>
            Test API endpoints and view responses
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="endpoint">Endpoint</Label>
            <Input
              id="endpoint"
              value={endpoint}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setEndpoint(e.target.value)
              }
              placeholder="/api/..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="method">Method</Label>
            <select
              id="method"
              value={method}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setMethod(e.target.value)
              }
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>

          {method !== "GET" && (
            <div className="space-y-2">
              <Label htmlFor="body">Request Body (JSON)</Label>
              <textarea
                id="body"
                value={body}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setBody(e.target.value)
                }
                placeholder="{}"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono"
              />
            </div>
          )}

          <Button onClick={handleTest} disabled={isLoading}>
            {isLoading ? "Testing..." : "Test Endpoint"}
          </Button>

          <div className="space-y-2">
            <Label>Response History</Label>
            <div className="h-[400px] overflow-auto rounded-md border p-4">
              {responses.map((response, index) => (
                <div
                  key={index}
                  className="mb-4 rounded-lg bg-muted p-4 text-sm"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        response.status >= 200 && response.status < 300
                          ? "bg-green-500"
                          : "bg-red-500"
                      }`}
                    />
                    <span className="font-mono">
                      Status: {response.status} ({response.statusText})
                    </span>
                  </div>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all font-mono">
                    {JSON.stringify(response.data, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
