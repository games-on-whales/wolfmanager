"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SocketService } from "@/lib/services/socket-service";
import { LogComponent, logger } from "@/lib/logger";
import {
  API_ERROR_CODES,
  createErrorResponse,
  createSuccessResponse,
  type ApiResponse,
} from "@/lib/api-utils";

/**
 * API Test Actions
 * 
 * These actions provide secure server-side testing of Wolf API endpoints
 * through the centralized socket service with proper authentication,
 * logging, and error handling.
 */

interface ApiTestRequest {
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

interface ApiTestResponse {
  status: number;
  statusText: string;
  data: unknown;
  headers?: Record<string, string>;
  duration?: number;
}

/**
 * Get authenticated session or return error response
 */
async function getAuthenticatedSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    await logger.warn(LogComponent.API, "API test attempted without authentication");
    return null;
  }
  
  // Only allow admin users to test APIs
  if (session.user.role !== "admin") {
    await logger.warn(LogComponent.API, "API test attempted by non-admin user", {
      userId: session.user.id,
      role: session.user.role,
    });
    return null;
  }
  
  return session;
}

/**
 * Test a Wolf API endpoint through the secure socket service
 */
export async function testWolfApiAction(request: ApiTestRequest): Promise<ApiResponse<ApiTestResponse>> {
  try {
    const session = await getAuthenticatedSession();
    if (!session) {
      return createErrorResponse(
        API_ERROR_CODES.UNAUTHORIZED,
        "Admin authentication required for API testing"
      );
    }

    const { endpoint, method, body, headers = {} } = request;

    // Validate endpoint format
    if (!endpoint.startsWith("/")) {
      return createErrorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        "Endpoint must start with '/'"
      );
    }

    await logger.debug(LogComponent.API, "Testing Wolf API endpoint", {
      userId: session.user.id,
      endpoint,
      method,
      hasBody: !!body,
    });

    const startTime = Date.now();
    const socketService = SocketService.getInstance();
    
    // Call the Wolf API through the socket service
    const response = await socketService.callWolfApi(session, endpoint, {
      method,
      body,
      headers,
    });

    const duration = Date.now() - startTime;

    // Construct the test response
    const testResponse: ApiTestResponse = {
      status: response.statusCode || (response.success ? 200 : 500),
      statusText: response.success ? "OK" : "Error",
      data: response.success ? response.data : { error: response.error },
      duration,
    };

    await logger.debug(LogComponent.API, "Wolf API test completed", {
      userId: session.user.id,
      endpoint,
      method,
      status: testResponse.status,
      duration,
      success: response.success,
    });

    return createSuccessResponse(testResponse);
  } catch (error) {
    await logger.error(LogComponent.API, "Error testing Wolf API", error, {
      endpoint: request.endpoint,
      method: request.method,
    });
    
    const errorResponse: ApiTestResponse = {
      status: 500,
      statusText: "Internal Server Error",
      data: { 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      },
    };

    return createSuccessResponse(errorResponse);
  }
}

/**
 * Test a Steam API endpoint (proxy through Next.js API routes)
 */
export async function testSteamApiAction(request: ApiTestRequest): Promise<ApiResponse<ApiTestResponse>> {
  try {
    const session = await getAuthenticatedSession();
    if (!session) {
      return createErrorResponse(
        API_ERROR_CODES.UNAUTHORIZED,
        "Admin authentication required for API testing"
      );
    }

    const { endpoint, method, body } = request;

    // Validate endpoint format for Steam API
    if (!endpoint.startsWith("/api/libraries/steam/")) {
      return createErrorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        "Steam API endpoints must start with '/api/libraries/steam/'"
      );
    }

    await logger.debug(LogComponent.API, "Testing Steam API endpoint", {
      userId: session.user.id,
      endpoint,
      method,
      hasBody: !!body,
    });

    const startTime = Date.now();
    
    // Make internal request to our own API route
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const fullUrl = `${baseUrl}${endpoint}`;
    
    const fetchOptions: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        // Add session cookie for authentication
        "Cookie": `next-auth.session-token=${session.user.id}`,
      },
    };

    if (method !== "GET" && body) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(fullUrl, fetchOptions);
    const duration = Date.now() - startTime;
    
    let responseData: unknown;
    const responseText = await response.text();
    
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    const testResponse: ApiTestResponse = {
      status: response.status,
      statusText: response.statusText,
      data: responseData,
      duration,
    };

    await logger.debug(LogComponent.API, "Steam API test completed", {
      userId: session.user.id,
      endpoint,
      method,
      status: response.status,
      duration,
    });

    return createSuccessResponse(testResponse);
  } catch (error) {
    await logger.error(LogComponent.API, "Error testing Steam API", error, {
      endpoint: request.endpoint,
      method: request.method,
    });
    
    const errorResponse: ApiTestResponse = {
      status: 500,
      statusText: "Internal Server Error",
      data: { 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      },
    };

    return createSuccessResponse(errorResponse);
  }
}

/**
 * Test a System API endpoint (proxy through Next.js API routes)
 */
export async function testSystemApiAction(request: ApiTestRequest): Promise<ApiResponse<ApiTestResponse>> {
  try {
    const session = await getAuthenticatedSession();
    if (!session) {
      return createErrorResponse(
        API_ERROR_CODES.UNAUTHORIZED,
        "Admin authentication required for API testing"
      );
    }

    const { endpoint, method, body } = request;

    // Validate endpoint format for System API
    if (!endpoint.startsWith("/api/system/")) {
      return createErrorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        "System API endpoints must start with '/api/system/'"
      );
    }

    await logger.debug(LogComponent.API, "Testing System API endpoint", {
      userId: session.user.id,
      endpoint,
      method,
      hasBody: !!body,
    });

    const startTime = Date.now();
    
    // Make internal request to our own API route
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const fullUrl = `${baseUrl}${endpoint}`;
    
    const fetchOptions: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        // Add session cookie for authentication
        "Cookie": `next-auth.session-token=${session.user.id}`,
      },
    };

    if (method !== "GET" && body) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(fullUrl, fetchOptions);
    const duration = Date.now() - startTime;
    
    let responseData: unknown;
    const responseText = await response.text();
    
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    const testResponse: ApiTestResponse = {
      status: response.status,
      statusText: response.statusText,
      data: responseData,
      duration,
    };

    await logger.debug(LogComponent.API, "System API test completed", {
      userId: session.user.id,
      endpoint,
      method,
      status: response.status,
      duration,
    });

    return createSuccessResponse(testResponse);
  } catch (error) {
    await logger.error(LogComponent.API, "Error testing System API", error, {
      endpoint: request.endpoint,
      method: request.method,
    });
    
    const errorResponse: ApiTestResponse = {
      status: 500,
      statusText: "Internal Server Error",
      data: { 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      },
    };

    return createSuccessResponse(errorResponse);
  }
}

/**
 * Get available Wolf API endpoints from schema
 */
export async function getWolfApiEndpointsAction(): Promise<ApiResponse<{ endpoints: any[] }>> {
  try {
    const session = await getAuthenticatedSession();
    if (!session) {
      return createErrorResponse(
        API_ERROR_CODES.UNAUTHORIZED,
        "Admin authentication required"
      );
    }

    await logger.debug(LogComponent.API, "Getting Wolf API endpoints", {
      userId: session.user.id,
    });

    const socketService = SocketService.getInstance();
    const response = await socketService.callWolfApi(session, "/openapi-schema", {
      method: "GET",
    });

    if (!response.success) {
      await logger.error(LogComponent.API, "Failed to get Wolf API schema", new Error(response.error || "Unknown error"), {
        userId: session.user.id,
        statusCode: response.statusCode,
      });
      return createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        response.error || "Failed to retrieve API schema"
      );
    }

    // Extract endpoints from OpenAPI schema
    const schema = response.data as any;
    const endpoints: any[] = [];

    if (schema?.paths) {
      Object.entries(schema.paths).forEach(([path, methods]: [string, any]) => {
        Object.entries(methods).forEach(([method, details]: [string, any]) => {
          endpoints.push({
            path: path.replace("/api/v1", ""), // Remove API prefix for Wolf endpoints
            method: method.toUpperCase(),
            summary: details.summary || "",
            description: details.description || "",
            requestSchema: details.requestBody?.content?.["application/json"]?.schema,
            responseSchema: details.responses?.["200"]?.content?.["application/json"]?.schema,
            components: schema.components,
            group: "Wolf API",
          });
        });
      });
    }

    await logger.debug(LogComponent.API, "Successfully retrieved Wolf API endpoints", {
      userId: session.user.id,
      endpointCount: endpoints.length,
    });

    return createSuccessResponse({ endpoints });
  } catch (error) {
    await logger.error(LogComponent.API, "Error getting Wolf API endpoints", error);
    return createErrorResponse(
      API_ERROR_CODES.INTERNAL_ERROR,
      "Failed to retrieve API endpoints"
    );
  }
}