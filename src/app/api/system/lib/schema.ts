export interface SystemApiEndpointDetails {
  summary?: string;
  description?: string;
  requestBody?: {
    content?: {
      "application/json"?: {
        schema?: unknown;
      };
    };
  };
  responses?: {
    [key: string]: {
      content?: {
        "application/json"?: {
          schema?: unknown;
        };
      };
    };
  };
}

export interface SystemApiSchema {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  paths: {
    [path: string]: {
      [method: string]: SystemApiEndpointDetails;
    };
  };
  components: {
    schemas: Record<string, any>;
  };
}

let systemApiSchema: SystemApiSchema = {
  openapi: "3.0.0",
  info: {
    title: "System API",
    version: "1.0.0",
  },
  paths: {
    "/api/system/sync-steam-library": {
      post: {
        summary: "Sync Steam Library",
        description:
          "Synchronizes Steam libraries for all users with Steam credentials",
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      description: "Whether the sync was successful",
                    },
                    error: {
                      type: "string",
                      description: "Error message if sync failed",
                    },
                  },
                  required: ["success"],
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {},
  },
};

export interface EndpointInfo {
  path: string;
  method: string;
  summary: string;
  description: string;
  requestSchema?: unknown;
  responseSchema?: unknown;
  components?: {
    schemas: Record<string, any>;
  };
}

export async function getAvailableSystemEndpoints(): Promise<EndpointInfo[]> {
  return Object.entries(systemApiSchema.paths)
    .map(([path, methods]) => {
      return Object.entries(
        methods as Record<string, SystemApiEndpointDetails>
      ).map(([method, details]) => ({
        path,
        method: method.toUpperCase(),
        summary: details.summary || "",
        description: details.description || "",
        requestSchema:
          details.requestBody?.content?.["application/json"]?.schema,
        responseSchema:
          details.responses?.["200"]?.content?.["application/json"]?.schema,
        components: systemApiSchema.components,
      }));
    })
    .flat();
}
