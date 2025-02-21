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
  if (cachedSchema) {
    return cachedSchema;
  }

  try {
    const response = await callWolfApi("/openapi-schema", { method: "GET" });
    cachedSchema = response as WolfApiSchema;
    return cachedSchema;
  } catch (error) {
    console.error("[WOLF_SCHEMA] Failed to load schema:", error);
    throw error;
  }
}

export async function isValidWolfEndpoint(
  endpoint: string,
  method: string
): Promise<boolean> {
  try {
    const schema = await getWolfSchema();
    const apiPath = `/api/v1${endpoint}`;
    const methodKey =
      method.toLowerCase() as keyof WolfApiSchema["paths"][string];
    return !!schema.paths[apiPath]?.[methodKey];
  } catch (error) {
    console.error("[WOLF_SCHEMA] Error validating endpoint:", error);
    return false;
  }
}
