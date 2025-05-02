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
import { LogComponent } from "@/lib/logger";
import { clientLogger } from "@/lib/logger/client";
import { showToast } from "@/lib/toast";
import { Check, ChevronDown, ChevronRight, Copy, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { toast } from "sonner";
import { MethodChip } from "./method-chip";

interface ApiResponse {
  status: number;
  statusText: string;
  data: any;
}

interface Endpoint {
  path: string;
  method: string;
  summary: string;
  description: string;
  requestSchema?: any;
  responseSchema?: any;
  components?: {
    schemas?: Record<string, any> | Record<string, unknown>;
  };
  group: string;
}

interface ApiTestConsoleClientProps {
  apiKey: string;
  endpoints: Endpoint[];
}

export default function ApiTestConsoleClient({ apiKey, endpoints }: ApiTestConsoleClientProps) {
  const [endpoint, setEndpoint] = useState(endpoints[0]?.path || "");
  const [method, setMethod] = useState(endpoints[0]?.method || "GET");
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(endpoints[0] || null);
  const [body, setBody] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [response, setResponse] = useState("");
  const [latestResponse, setLatestResponse] = useState<ApiResponse | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // ...existing hooks and logic

  function generateDefaultBody(schema: any): any {
    if (!schema) return {};
    if (schema.$ref) {
      const refPath = schema.$ref.split("/");
      const schemaName = refPath[refPath.length - 1];
      const refSchema = selectedEndpoint?.requestSchema?.components?.schemas?.[schemaName];
      if (refSchema) {
        return generateDefaultBody(refSchema);
      }
    }
    if (schema.type === "object") {
      const result: any = {};
      if (schema.properties) {
        Object.entries(schema.properties).forEach(
          ([key, value]: [string, any]) => {
            const isRequired = schema.required?.includes(key);
            if (isRequired || value.example !== undefined) {
              switch (value.type) {
                case "string":
                  result[key] = value.example || "";
                  break;
                case "number":
                case "integer":
                  result[key] = value.example || 0;
                  break;
                case "boolean":
                  result[key] = value.example || false;
                  break;
                case "array":
                  result[key] = value.example || [];
                  break;
                case "object":
                  result[key] = generateDefaultBody(value);
                  break;
                default:
                  if (value.$ref) {
                    const refPath = value.$ref.split("/");
                    const schemaName = refPath[refPath.length - 1];
                    const refSchema = selectedEndpoint?.requestSchema?.components?.schemas?.[schemaName];
                    if (refSchema) {
                      result[key] = generateDefaultBody(refSchema);
                    }
                  } else {
                    result[key] = null;
                  }
              }
            }
          }
        );
      }
      return result;
    }
    if (schema.example !== undefined) {
      return schema.example;
    }
    switch (schema.type) {
      case "string": return "";
      case "number":
      case "integer": return 0;
      case "boolean": return false;
      case "array": return [];
      default: return null;
    }
  }

  useEffect(() => {
    if (endpoints.length > 0) {
      setEndpoint(endpoints[0].path);
      setMethod(endpoints[0].method);
      setSelectedEndpoint(endpoints[0]);
    }
  }, [endpoints]);

  useEffect(() => {
    const found = endpoints.find(
      (e) => e.path === endpoint && e.method === method
    );
    setSelectedEndpoint(found || null);

    if (found?.requestSchema) {
      try {
        let schema = found.requestSchema;
        if (schema.$ref) {
          const refPath = schema.$ref.split("/");
          const schemaName = refPath[refPath.length - 1];
          schema = found.requestSchema.components?.schemas?.[schemaName];
        }
        const defaultBody = generateDefaultBody(schema);
        setBody(JSON.stringify(defaultBody, null, 2));
      } catch (error) {
        console.error("[API_TEST] Failed to generate default body:", error);
        setBody("{}");
      }
    } else {
      setBody("");
    }
  }, [endpoint, method, endpoints]);

  const groupedEndpoints = useMemo(() => {
    const groups: Record<string, Endpoint[]> = {};
    endpoints.forEach((endpoint) => {
      const group = endpoint.group || "Other";
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(endpoint);
    });
    return groups;
  }, [endpoints]);

  const filteredEndpoints = useMemo(() => {
    const groups: Record<string, Endpoint[]> = {};
    Object.entries(groupedEndpoints).forEach(([group, endpoints]) => {
      const filtered = endpoints.filter(
        (e) =>
          e.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (filtered.length > 0) {
        groups[group] = filtered;
      }
    });
    return groups;
  }, [groupedEndpoints, searchQuery]);

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const formatRequestBody = (value: string): string => {
    try {
      const parsed = JSON.parse(value);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return value;
    }
  };

  const handleTest = async () => {
    try {
      if (!endpoint.startsWith("/api/")) {
        clientLogger.warn(LogComponent.WOLF_UI, "Invalid API endpoint format", {
          endpoint,
          message: "API endpoints should start with /api/",
        });
        toast.error("Invalid API endpoint format");
        return;
      }
      let finalEndpoint = endpoint;
      let finalBody = body;
      if (body) {
        try {
          const bodyData = JSON.parse(body);
          Object.entries(bodyData).forEach(([key, value]) => {
            if (finalEndpoint.includes(`{${key}}`)) {
              finalEndpoint = finalEndpoint.replace(`{${key}}`, String(value));
              const { [key]: _, ...rest } = bodyData;
              finalBody = JSON.stringify(rest, null, 2);
            }
          });
        } catch (error) {
          console.error("[API_TEST] Failed to parse body:", error);
        }
      }
      clientLogger.info(LogComponent.WOLF_UI, "Testing API endpoint", {
        method,
        originalEndpoint: endpoint,
        finalEndpoint,
        hasBody: method !== "GET" && !!finalBody,
      });
      setIsLoading(true);
      setResponse("");
      setLatestResponse(null);
      const baseUrl = window.location.origin;
      const fullUrl = `${baseUrl}${finalEndpoint}`;
      clientLogger.debug(LogComponent.WOLF_UI, "Making API request", {
        fullUrl,
        method,
        bodySize: finalBody ? finalBody.length : 0,
      });
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (endpoint.startsWith("/api/wolf/")) {
        headers["X-API-Key"] = apiKey;
      }
      const response = await fetch(fullUrl, {
        method,
        headers,
        body: method !== "GET" ? finalBody : undefined,
        credentials: "include",
      });
      let data;
      const responseText = await response.text();
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        const err = new Error(
          `Invalid JSON response: ${responseText.substring(0, 100)}...`
        );
        await clientLogger.error(
          LogComponent.WOLF_UI,
          "Failed to parse API response",
          err,
          {
            responseText: responseText.substring(0, 200) + "...",
            contentType: response.headers.get("content-type"),
          }
        );
        throw err;
      }
      const newResponse: ApiResponse = {
        status: response.status,
        statusText: response.statusText,
        data,
      };
      setLatestResponse(newResponse);
      setResponse(JSON.stringify(data, null, 2));
      if (response.ok) {
        showToast.success("Test Successful", {
          description: "API endpoint test completed successfully",
        });
        await clientLogger.info(
          LogComponent.WOLF_UI,
          "API request successful",
          {
            endpoint,
            responseSize: responseText.length,
          }
        );
      } else {
        let errorMessage = `API request failed: ${response.statusText}`;
        if (data?.error?.message) {
          errorMessage += ` - ${data.error.message}`;
        }
        const err = new Error(errorMessage);
        await clientLogger.error(
          LogComponent.WOLF_UI,
          "API request failed",
          err
        );
        showToast.error("Test Failed", err);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error("API request error");
      await clientLogger.error(LogComponent.WOLF_UI, "API request error", err, {
        endpoint,
        method,
        requestBody: method !== "GET" ? body : undefined,
      });
      const failedResponse: ApiResponse = {
        status: 0,
        statusText: "Request Failed",
        data: { error: err.message },
      };
      setLatestResponse(failedResponse);
      setResponse(JSON.stringify(failedResponse.data, null, 2));
      showToast.error("Test Failed", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!latestResponse) return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(latestResponse.data, null, 2)
      );
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      showToast.success("Copied", {
        description: "Response copied to clipboard",
      });
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error("Failed to copy to clipboard");
      showToast.error("Copy Failed", "Failed to copy response to clipboard");
    }
  };

  return (
    <Card className="h-[calc(100vh-12rem)]">
      <CardHeader>
        <CardTitle>API Test Console</CardTitle>
        <CardDescription>
          Test Wolf API endpoints with schema validation
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-[350px_1fr] gap-6 h-[calc(100%-5rem)] overflow-hidden">
        {/* Left Column - Endpoint List */}
        <div className="border-r pr-6 h-full flex flex-col">
          <div className="relative mb-4">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search endpoints..."
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {isLoadingSchema ? (
              <div className="p-2 text-sm text-muted-foreground">
                Loading endpoints...
              </div>
            ) : endpoints.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground">
                No endpoints available
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(filteredEndpoints).map(([group, endpoints]) => (
                  <div key={group} className="space-y-1">
                    <div
                      className="flex items-center space-x-2 cursor-pointer hover:text-primary"
                      onClick={() => toggleGroup(group)}
                    >
                      {expandedGroups[group] ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <span className="font-medium">{group}</span>
                      <span className="text-muted-foreground text-sm">
                        ({endpoints.length})
                      </span>
                    </div>
                    {expandedGroups[group] && (
                      <div className="ml-6 space-y-1">
                        {endpoints.map((e) => (
                          <div
                            key={`${e.method}-${e.path}`}
                            className={`flex items-center space-x-2 p-2 rounded cursor-pointer hover:bg-muted ${
                              endpoint === e.path && method === e.method
                                ? "bg-muted"
                                : ""
                            }`}
                            onClick={() => {
                              setEndpoint(e.path);
                              setMethod(e.method);
                              setSelectedEndpoint(e);
                            }}
                          >
                            <MethodChip method={e.method} />
                            <span className="text-sm font-mono">{e.path}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Right Column - Test Interface */}
        <div className="flex flex-col h-full overflow-hidden">
          {selectedEndpoint ? (
            <>
              <div className="flex items-center gap-2 mb-4">
                <MethodChip method={selectedEndpoint.method} />
                <span className="font-mono">{selectedEndpoint.path}</span>
              </div>
              {selectedEndpoint.description && (
                <div className="text-sm text-muted-foreground mb-4">
                  {selectedEndpoint.description}
                </div>
              )}
              {method !== "GET" && selectedEndpoint?.requestSchema && (
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="body">Request Body (JSON)</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => setBody(formatRequestBody(body))}
                    >
                      Format JSON
                    </Button>
                  </div>
                  {/* Schema Information */}
                  <div className="rounded-md border bg-muted p-3 text-sm space-y-2">
                    <div className="font-medium">Schema Properties:</div>
                    <div className="space-y-1">
                      {Object.entries(
                        selectedEndpoint.requestSchema.properties || {}
                      ).map(([key, value]: [string, any]) => (
                        <div
                          key={key}
                          className="grid grid-cols-[120px_1fr] gap-2"
                        >
                          <div className="font-mono text-xs">{key}</div>
                          <div className="text-xs text-muted-foreground">
                            <span className="text-primary">{value.type}</span>
                            {value.required && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                            {value.description && (
                              <span className="block">{value.description}</span>
                            )}
                            {value.example && (
                              <span className="block text-green-500 dark:text-green-400">
                                Example: {typeof value.example === "object"
                                  ? JSON.stringify(value.example)
                                  : String(value.example)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md border bg-zinc-950 overflow-hidden relative">
                    <div className="pointer-events-none">
                      <SyntaxHighlighter
                        language="json"
                        style={oneDark}
                        customStyle={{
                          margin: 0,
                          padding: "1rem",
                          borderRadius: 0,
                          background: "transparent",
                          minHeight: "120px",
                        }}
                      >
                        {body || "{}"}
                      </SyntaxHighlighter>
                    </div>
                    <textarea
                      id="body"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="{}"
                      spellCheck={false}
                      className="font-mono text-sm w-full h-full absolute top-0 left-0 right-0 bottom-0 bg-transparent text-transparent caret-white resize-none p-4 focus-visible:outline-none"
                    />
                  </div>
                </div>
              )}
              <Button
                onClick={handleTest}
                disabled={isLoading || isLoadingSchema}
                className="w-fit mb-4"
              >
                {isLoading ? "Testing..." : "Test Endpoint"}
              </Button>
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <Label>Response</Label>
                  {latestResponse && (
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded px-2 py-1 text-xs ${
                          latestResponse.status >= 200 &&
                          latestResponse.status < 300
                            ? "bg-green-500/10 text-green-500"
                            : "bg-red-500/10 text-red-500"
                        }`}
                      >
                        {latestResponse.status} {latestResponse.statusText}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleCopy}
                      >
                        {isCopied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
                <div className="h-full rounded-md border bg-zinc-950 overflow-hidden">
                  {latestResponse ? (
                    <SyntaxHighlighter
                      language="json"
                      style={oneDark}
                      customStyle={{
                        margin: 0,
                        borderRadius: 0,
                        background: "transparent",
                      }}
                      className="h-full"
                    >
                      {JSON.stringify(latestResponse.data, null, 2)}
                    </SyntaxHighlighter>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground p-4">
                      No response yet. Click "Test Endpoint" to see the results.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select an endpoint to test
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}