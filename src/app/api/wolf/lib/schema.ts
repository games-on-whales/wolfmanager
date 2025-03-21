import { LogComponent, logger } from "@/lib/logger";
import { z } from "zod";

export interface WolfApiEndpointDetails {
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

export interface WolfApiSchema {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  paths: {
    [path: string]: {
      [method: string]: WolfApiEndpointDetails;
    };
  };
  components?: {
    schemas?: Record<string, unknown>;
  };
}

let wolfApiSchema: WolfApiSchema | null = null;
let loadingPromise: Promise<WolfApiSchema> | null = null;

export async function loadWolfApiSchema(): Promise<WolfApiSchema> {
  // Return existing schema if available
  if (wolfApiSchema) {
    return wolfApiSchema;
  }

  // Return existing promise if we're already loading
  if (loadingPromise) {
    return loadingPromise;
  }

  // Start new load
  loadingPromise = (async () => {
    try {
      const response = await fetch("/api/wolf/schema");
      if (!response.ok) {
        throw new Error(`Failed to fetch schema: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      wolfApiSchema = data as WolfApiSchema;
      return wolfApiSchema;
    } catch (error) {
      await logger.error(
        LogComponent.WOLF_UI,
        "Failed to load Wolf API schema",
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

export async function isValidWolfEndpoint(
  endpoint: string,
  method: string
): Promise<boolean> {
  try {
    const schema = await loadWolfApiSchema();
    const apiPath = `/api/v1${endpoint}`;
    const methodKey = method.toLowerCase();
    return !!schema.paths[apiPath]?.[methodKey];
  } catch (error) {
    await logger.error(
      LogComponent.WOLF_UI,
      "Error validating endpoint",
      error instanceof Error ? error : new Error(String(error))
    );
    return false;
  }
}

export interface EndpointInfo {
  path: string;
  method: string;
  summary: string;
  description: string;
  requestSchema?: unknown;
  responseSchema?: unknown;
  components?: WolfApiSchema["components"];
}

export async function getAvailableEndpoints(): Promise<EndpointInfo[]> {
  const schema = await loadWolfApiSchema();

  return Object.entries(schema.paths)
    .map(([path, methods]) => {
      return Object.entries(
        methods as Record<string, WolfApiEndpointDetails>
      ).map(([method, details]) => ({
        path: path.replace("/api/v1", ""),
        method: method.toUpperCase(),
        summary: details.summary || "",
        description: details.description || "",
        requestSchema:
          details.requestBody?.content?.["application/json"]?.schema,
        responseSchema:
          details.responses?.["200"]?.content?.["application/json"]?.schema,
        components: schema.components,
      }));
    })
    .flat();
}

export interface ValidationSuccess {
  success: true;
  data: unknown;
}

export interface ValidationError {
  success: false;
  error: z.ZodError;
}

export type ValidationResult = ValidationSuccess | ValidationError;

export async function validateRequestBody(
  endpoint: string,
  method: string,
  body: unknown
): Promise<ValidationResult> {
  const schema = await loadWolfApiSchema();
  const apiPath = `/api/v1${endpoint}`;
  const methodKey = method.toLowerCase();
  const operation = schema.paths[apiPath]?.[methodKey] as
    | WolfApiEndpointDetails
    | undefined;

  if (!operation?.requestBody?.content?.["application/json"]?.schema) {
    return { success: true, data: body };
  }

  const requestSchema =
    operation.requestBody.content["application/json"].schema;
  const zodSchema = createZodSchemaFromOpenApi(requestSchema);
  const result = zodSchema.safeParse(body);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}

function createZodSchemaFromOpenApi(schema: any): z.ZodType {
  if (!schema) {
    return z.any();
  }

  if (schema.$ref && wolfApiSchema?.components?.schemas) {
    const refPath = schema.$ref.split("/");
    const schemaName = refPath[refPath.length - 1];
    const refSchema = wolfApiSchema.components.schemas[schemaName];
    return createZodSchemaFromOpenApi(refSchema);
  }

  switch (schema.type) {
    case "object":
      const shape: Record<string, z.ZodType> = {};
      if (schema.properties) {
        Object.entries(schema.properties).forEach(
          ([key, value]: [string, any]) => {
            shape[key] = createZodSchemaFromOpenApi(value);
          }
        );
      }
      let objectSchema = z.object(shape);
      if (schema.required?.length) {
        return objectSchema.required(schema.required);
      }
      return objectSchema;

    case "array":
      return z.array(createZodSchemaFromOpenApi(schema.items));

    case "string":
      let stringSchema = z.string();
      if (schema.enum) {
        return z.enum(schema.enum as [string, ...string[]]);
      }
      return stringSchema;

    case "number":
      return z.number();

    case "integer":
      return z.number().int();

    case "boolean":
      return z.boolean();

    case "null":
      return z.null();

    default:
      if (schema.anyOf) {
        return z.union(schema.anyOf.map(createZodSchemaFromOpenApi));
      }
      return z.any();
  }
}
