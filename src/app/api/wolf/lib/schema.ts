import { z } from "zod";

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
      console.error("[WOLF_SCHEMA] Failed to load schema:", error);
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
    const methodKey =
      method.toLowerCase() as keyof WolfApiSchema["paths"][string];
    return !!schema.paths[apiPath]?.[methodKey];
  } catch (error) {
    console.error("[WOLF_SCHEMA] Error validating endpoint:", error);
    return false;
  }
}

export async function getAvailableEndpoints() {
  const schema = await loadWolfApiSchema();

  return Object.entries(schema.paths)
    .map(([path, methods]) => {
      return Object.entries(methods).map(([method, details]) => ({
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
  data: any;
}

export interface ValidationError {
  success: false;
  error: z.ZodError;
}

export type ValidationResult = ValidationSuccess | ValidationError;

export async function validateRequestBody(
  endpoint: string,
  method: string,
  body: any
): Promise<ValidationResult> {
  const schema = await loadWolfApiSchema();
  const apiPath = `/api/v1${endpoint}`;
  const methodKey =
    method.toLowerCase() as keyof WolfApiSchema["paths"][string];
  const operation = schema.paths[apiPath]?.[methodKey];

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
  if (schema.$ref) {
    const refPath = schema.$ref.split("/");
    const schemaName = refPath[refPath.length - 1];
    const refSchema = wolfApiSchema?.components.schemas[schemaName];
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
