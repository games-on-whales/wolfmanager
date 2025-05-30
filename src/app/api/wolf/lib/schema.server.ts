import "server-only";
import { callWolfApi } from "./wolf-socket.server";

export interface WolfApiSchema {
  paths: Record<
    string,
    {
      get?: any;
      post?: any;
      put?: any;
      delete?: any;
    }
  >;
  components: {
    schemas: Record<string, any>;
  };
}

let cachedSchema: WolfApiSchema | null = null;

export async function getWolfSchema(): Promise<WolfApiSchema> {
  console.log("[WOLF_SCHEMA_DEBUG] getWolfSchema called", {
    hasCachedSchema: !!cachedSchema,
    timestamp: new Date().toISOString(),
  });

  if (cachedSchema) {
    console.log("[WOLF_SCHEMA_DEBUG] Returning cached schema", {
      pathCount: Object.keys(cachedSchema.paths || {}).length,
    });
    return cachedSchema;
  }

  try {
    console.log("[WOLF_SCHEMA_DEBUG] Fetching schema from wolf socket...");
    const response = await callWolfApi("/openapi-schema", { method: "GET" });
    console.log("[WOLF_SCHEMA_DEBUG] Schema fetched successfully", {
      responseType: typeof response,
      hasResponse: !!response,
      pathCount: response && typeof response === 'object' && 'paths' in response
        ? Object.keys((response as any).paths || {}).length
        : 'unknown',
    });
    
    cachedSchema = response as WolfApiSchema;
    console.log("[WOLF_SCHEMA_DEBUG] Schema cached", {
      pathCount: Object.keys(cachedSchema.paths || {}).length,
    });
    return cachedSchema;
  } catch (error) {
    console.error("[WOLF_SCHEMA_DEBUG] Failed to load schema:", {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

export async function isValidWolfEndpoint(
  endpoint: string,
  method: string
): Promise<boolean> {
  console.log("[WOLF_ENDPOINT_DEBUG] Validating endpoint", {
    endpoint,
    method,
    timestamp: new Date().toISOString(),
  });

  try {
    console.log("[WOLF_ENDPOINT_DEBUG] Getting wolf schema...");
    const schema = await getWolfSchema();
    console.log("[WOLF_ENDPOINT_DEBUG] Schema retrieved", {
      hasSchema: !!schema,
      pathCount: Object.keys(schema.paths || {}).length,
    });

    const apiPath = `/api/v1${endpoint}`;
    const methodKey =
      method.toLowerCase() as keyof WolfApiSchema["paths"][string];
    
    console.log("[WOLF_ENDPOINT_DEBUG] Checking endpoint validity", {
      apiPath,
      methodKey,
      hasPath: !!schema.paths[apiPath],
      hasMethod: !!schema.paths[apiPath]?.[methodKey],
      availableMethods: schema.paths[apiPath] ? Object.keys(schema.paths[apiPath]) : [],
    });

    const isValid = !!schema.paths[apiPath]?.[methodKey];
    console.log("[WOLF_ENDPOINT_DEBUG] Validation result", {
      endpoint,
      method,
      apiPath,
      isValid,
    });

    return isValid;
  } catch (error) {
    console.error("[WOLF_ENDPOINT_DEBUG] Error validating endpoint:", {
      endpoint,
      method,
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    return false;
  }
}
