import "server-only";
import { SocketService } from "@/lib/services/socket-service";
import { LogComponent, logger } from "@/lib/logger";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
  await logger.debug(LogComponent.API, "Getting Wolf schema", {
    hasCachedSchema: !!cachedSchema,
  });

  if (cachedSchema) {
    await logger.debug(LogComponent.API, "Returning cached Wolf schema", {
      pathCount: Object.keys(cachedSchema.paths || {}).length,
    });
    return cachedSchema;
  }

  try {
    // Get current session for schema fetching
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      await logger.warn(LogComponent.API, "No session available for schema fetch");
      throw new Error("Authentication required for schema access");
    }

    await logger.debug(LogComponent.API, "Fetching Wolf schema from socket service");
    const socketService = SocketService.getInstance();
    const response = await socketService.callWolfApi(session, "/openapi-schema", {
      method: "GET",
    });

    if (!response.success) {
      await logger.error(LogComponent.API, "Failed to fetch Wolf schema", new Error(response.error || "Unknown error"), {
        statusCode: response.statusCode,
      });
      throw new Error(response.error || "Failed to fetch schema");
    }

    cachedSchema = response.data as WolfApiSchema;
    await logger.debug(LogComponent.API, "Wolf schema cached successfully", {
      pathCount: Object.keys(cachedSchema.paths || {}).length,
    });
    
    return cachedSchema;
  } catch (error) {
    await logger.error(LogComponent.API, "Error loading Wolf schema", error);
    throw error;
  }
}

export async function isValidWolfEndpoint(
  endpoint: string,
  method: string
): Promise<boolean> {
  await logger.debug(LogComponent.API, "Validating Wolf endpoint", {
    endpoint,
    method,
  });

  try {
    const schema = await getWolfSchema();
    const apiPath = `/api/v1${endpoint}`;
    const methodKey = method.toLowerCase() as keyof WolfApiSchema["paths"][string];
    
    await logger.debug(LogComponent.API, "Checking endpoint validity", {
      apiPath,
      methodKey,
      hasPath: !!schema.paths[apiPath],
      hasMethod: !!schema.paths[apiPath]?.[methodKey],
      availableMethods: schema.paths[apiPath] ? Object.keys(schema.paths[apiPath]) : [],
    });

    const isValid = !!schema.paths[apiPath]?.[methodKey];
    
    await logger.debug(LogComponent.API, "Endpoint validation result", {
      endpoint,
      method,
      apiPath,
      isValid,
    });

    return isValid;
  } catch (error) {
    await logger.error(LogComponent.API, "Error validating Wolf endpoint", error, {
      endpoint,
      method,
    });
    return false;
  }
}
