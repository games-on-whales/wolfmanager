"use client";

import { getAvailableEndpoints } from "@/app/api/wolf/lib/schema";
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
import { clientLogger, LogComponent } from "@/lib/logger";
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
    schemas: Record<string, any>;
  };
}

interface ApiTestConsoleProps {
  apiKey: string;
}

export function ApiTestConsole({ apiKey }: ApiTestConsoleProps) {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [endpoint, setEndpoint] = useState("");
  const [method, setMethod] = useState("GET");
  const [body, setBody] = useState("");
  const [responses, setResponses] = useState<ApiResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSchema, setIsLoadingSchema] = useState(true);
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {}
  );
  const [latestResponse, setLatestResponse] = useState<ApiResponse | null>(
    null
  );
  const [isCopied, setIsCopied] = useState(false);
  const [response, setResponse] = useState("");

  useEffect(() => {
    async function loadEndpoints() {
      try {
        setIsLoadingSchema(true);
        const availableEndpoints = await getAvailableEndpoints();

        // Transform endpoints to include full schema information
        const transformedEndpoints = availableEndpoints.map((endpoint) => {
          let requestSchema = endpoint.requestSchema;

          // If the schema is a reference, include the components section
          if (requestSchema?.$ref) {
            requestSchema = {
              ...requestSchema,
              components: {
                schemas: endpoint.components?.schemas || {},
              },
            };
          }

          return {
            ...endpoint,
            requestSchema,
          };
        });

        setEndpoints(transformedEndpoints);
        if (transformedEndpoints.length > 0) {
          setEndpoint(transformedEndpoints[0].path);
          setMethod(transformedEndpoints[0].method);
          setSelectedEndpoint(transformedEndpoints[0]);
        }
      } catch (error) {
        console.error("[API_TEST] Failed to load endpoints:", error);
        let errorMessage = "Failed to load API endpoints";

        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (error && typeof error === "object" && "error" in error) {
          errorMessage = String((error as any).error);
        }

        toast.error(errorMessage);
      } finally {
        setIsLoadingSchema(false);
      }
    }
    loadEndpoints();
  }, []);

  useEffect(() => {
    const found = endpoints.find(
      (e) => e.path === endpoint && e.method === method
    );
    setSelectedEndpoint(found || null);

    // Automatically load example body when endpoint is selected
    if (found?.requestSchema) {
      try {
        // Get the actual schema from components if it's a reference
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

  const handleTest = async () => {
    try {
      clientLogger.info(LogComponent.WOLF_UI, "Testing API endpoint", {
        method,
        endpoint,
      });

      setIsLoading(true);
      setResponse("");

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      };

      const response = await fetch(endpoint, {
        method,
        headers,
        body: method !== "GET" ? body : undefined,
      });

      const data = await response.json();
      setResponse(JSON.stringify(data, null, 2));

      if (response.ok) {
        toast.success("API request successful");
        clientLogger.info(LogComponent.WOLF_UI, "API request successful", {
          status: response.status,
          endpoint,
        });
      } else {
        toast.error(`API request failed: ${response.statusText}`);
        clientLogger.error(LogComponent.WOLF_UI, "API request failed", {
          status: response.status,
          statusText: response.statusText,
          endpoint,
        });
      }
    } catch (error) {
      clientLogger.error(LogComponent.WOLF_UI, "API request error", error);
      toast.error("Failed to make API request");
      setResponse(error instanceof Error ? error.message : "Unknown error");
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
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error("Failed to copy to clipboard");
    }
  };

  function generateDefaultBody(schema: any): any {
    if (!schema) return {};

    // Handle $ref by using the referenced schema
    if (schema.$ref) {
      const refPath = schema.$ref.split("/");
      const schemaName = refPath[refPath.length - 1];
      const refSchema =
        selectedEndpoint?.requestSchema?.components?.schemas?.[schemaName];
      if (refSchema) {
        return generateDefaultBody(refSchema);
      }
    }

    if (schema.type === "object") {
      const result: any = {};
      if (schema.properties) {
        Object.entries(schema.properties).forEach(
          ([key, value]: [string, any]) => {
            // Check if the property is required
            const isRequired = schema.required?.includes(key);

            // If it's required or has an example, include it
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
                  // Handle $ref in property
                  if (value.$ref) {
                    const refPath = value.$ref.split("/");
                    const schemaName = refPath[refPath.length - 1];
                    const refSchema =
                      selectedEndpoint?.requestSchema?.components?.schemas?.[
                        schemaName
                      ];
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

    // Handle non-object types at the root level
    if (schema.example !== undefined) {
      return schema.example;
    }

    switch (schema.type) {
      case "string":
        return "";
      case "number":
      case "integer":
        return 0;
      case "boolean":
        return false;
      case "array":
        return [];
      default:
        return null;
    }
  }

  // Group endpoints by their first path segment and filter by search
  const groupedEndpoints = useMemo(() => {
    const filtered = endpoints.filter(
      (e) =>
        e.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.method.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // If we have a search query, automatically expand groups with matches
    if (searchQuery) {
      const groupsWithMatches = filtered.reduce((groups, endpoint) => {
        const group = endpoint.path.split("/")[1] || "root";
        groups.add(group);
        return groups;
      }, new Set<string>());

      setExpandedGroups((prev) => {
        const newState = { ...prev };
        groupsWithMatches.forEach((group) => {
          newState[group] = true;
        });
        return newState;
      });
    }

    return filtered.reduce((acc, endpoint) => {
      const group = endpoint.path.split("/")[1] || "root";
      if (!acc[group]) acc[group] = [];
      acc[group].push(endpoint);
      return acc;
    }, {} as Record<string, Endpoint[]>);
  }, [endpoints, searchQuery]);

  // Debounce search to avoid too many re-renders
  const debouncedSearch = useMemo(() => {
    const handler = (value: string) => {
      setSearchQuery(value);
      // If search is cleared, collapse all groups
      if (!value) {
        setExpandedGroups({});
      }
    };

    let timeoutId: NodeJS.Timeout;
    return (value: string) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => handler(value), 150);
    };
  }, []);

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  };

  // Format JSON for the request body
  const formatRequestBody = (value: string): string => {
    try {
      const parsed = JSON.parse(value);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return value;
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
              onChange={(e) => debouncedSearch(e.target.value)}
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
                {Object.entries(groupedEndpoints).map(
                  ([group, groupEndpoints]) => (
                    <div key={group} className="rounded-lg border">
                      <button
                        onClick={() => toggleGroup(group)}
                        className="w-full flex items-center justify-between p-2 hover:bg-accent hover:text-accent-foreground rounded-t-lg"
                      >
                        <span className="font-medium capitalize">{group}</span>
                        {expandedGroups[group] ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                      {expandedGroups[group] && (
                        <div className="p-2 space-y-1">
                          {groupEndpoints.map((e) => (
                            <button
                              key={`${e.method}:${e.path}`}
                              className={`w-full text-left px-2 py-1.5 rounded-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2 ${
                                endpoint === e.path && method === e.method
                                  ? "bg-accent text-accent-foreground"
                                  : ""
                              }`}
                              onClick={() => {
                                setMethod(e.method);
                                setEndpoint(e.path);
                              }}
                            >
                              <MethodChip method={e.method} />
                              <div className="flex flex-col">
                                <span className="font-mono text-sm">
                                  {e.path}
                                </span>
                                {e.summary && (
                                  <span className="text-xs text-muted-foreground">
                                    {e.summary}
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                )}
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
                                Example:{" "}
                                {typeof value.example === "object"
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
