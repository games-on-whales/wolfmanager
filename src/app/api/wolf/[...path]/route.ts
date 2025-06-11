import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { SocketService } from "@/lib/services/socket-service";
import { LogComponent, logger } from "@/lib/logger";
import { isValidWolfEndpoint } from "../lib/schema.server";

// This is a dynamic route that will handle all requests to /api/wolf/*
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = `/${params.path.join("/")}`;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      await logger.warn(LogComponent.API, "Wolf API access denied - no session", {
        path,
        method: "GET",
        url: request.url,
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await logger.debug(LogComponent.API, "Wolf API GET request", {
      path,
      method: "GET",
      userId: session.user.id,
      username: session.user.name,
    });

    // Validate endpoint
    let isValid: boolean;
    try {
      isValid = await isValidWolfEndpoint(path, "GET");
    } catch (validationError) {
      await logger.error(LogComponent.API, "Wolf API endpoint validation failed", validationError, {
        path,
        method: "GET",
        userId: session.user.id,
      });
      return NextResponse.json(
        {
          error: "Endpoint validation failed",
          details: validationError instanceof Error ? validationError.message : String(validationError),
        },
        { status: 500 }
      );
    }

    if (!isValid) {
      await logger.warn(LogComponent.API, "Wolf API invalid endpoint", {
        path,
        method: "GET",
        userId: session.user.id,
      });
      return NextResponse.json(
        { error: "Invalid endpoint or method" },
        { status: 400 }
      );
    }

    // Use centralized socket service
    const socketService = SocketService.getInstance();
    const response = await socketService.callWolfApi(session, path, { method: "GET" });

    if (!response.success) {
      await logger.error(LogComponent.API, "Wolf API call failed", new Error(response.error || "Unknown error"), {
        path,
        method: "GET",
        userId: session.user.id,
        statusCode: response.statusCode,
      });
      return NextResponse.json(
        { error: response.error || "Wolf API call failed" },
        { status: response.statusCode || 500 }
      );
    }

    // Special handling for /clients endpoint - validate and deduplicate response
    if (path === "/clients" && response.data) {
      await logger.debug(LogComponent.API, "Processing /clients endpoint response", {
        path,
        userId: session.user.id,
        responseType: typeof response.data,
        hasClients: !!(response.data as any)?.clients,
        clientsCount: Array.isArray((response.data as any)?.clients) ? (response.data as any).clients.length : 0
      });

      // Validate and log Wolf API clients response structure
      if (typeof response.data === "object" && response.data !== null) {
        const data = response.data as any;
        
        if (data.success === true && Array.isArray(data.clients)) {
          const clients = data.clients;
          
          // Detect duplicates in Wolf API response
          const clientIds = new Set<string>();
          const pairSecrets = new Set<string>();
          const duplicateStats = {
            byId: 0,
            byPairSecret: 0,
            withoutId: 0
          };
          
          for (const client of clients) {
            const clientId = client.client_id || client.id;
            const pairSecret = client.pair_secret;
            
            if (!clientId) {
              duplicateStats.withoutId++;
              continue;
            }
            
            if (clientIds.has(clientId)) {
              duplicateStats.byId++;
            } else {
              clientIds.add(clientId);
            }
            
            if (pairSecret) {
              if (pairSecrets.has(pairSecret)) {
                duplicateStats.byPairSecret++;
              } else {
                pairSecrets.add(pairSecret);
              }
            }
          }
          
          // Log duplicate detection results
          if (duplicateStats.byId > 0 || duplicateStats.byPairSecret > 0 || duplicateStats.withoutId > 0) {
            await logger.warn(LogComponent.API, "Wolf API /clients endpoint returned duplicate entries", {
              path,
              userId: session.user.id,
              totalClients: clients.length,
              uniqueClientIds: clientIds.size,
              duplicatesById: duplicateStats.byId,
              duplicatesByPairSecret: duplicateStats.byPairSecret,
              clientsWithoutId: duplicateStats.withoutId
            });
            
            // Apply deduplication before returning response
            const deduplicatedClients = Array.from(
              clients.reduce((map: Map<string, any>, client: any) => {
                const clientId = client.client_id || client.id;
                if (clientId) {
                  map.set(clientId, client);
                }
                return map;
              }, new Map<string, any>()).values()
            );
            
            await logger.info(LogComponent.WOLF_UI, "Wolf API client deduplication completed", {
              originalCount: clients.length,
              deduplicatedCount: deduplicatedClients.length,
              duplicatesById: duplicateStats.byId,
              duplicatesByPairSecret: duplicateStats.byPairSecret,
              totalDuplicatesRemoved: clients.length - deduplicatedClients.length
            });
            
            // Return deduplicated response
            return NextResponse.json({
              ...data,
              clients: deduplicatedClients
            });
          } else {
            await logger.debug(LogComponent.API, "Wolf API /clients response validation passed - no duplicates found", {
              path,
              userId: session.user.id,
              clientsCount: clients.length
            });
          }
        } else {
          await logger.warn(LogComponent.API, "Wolf API /clients response has unexpected structure", {
            path,
            userId: session.user.id,
            hasSuccess: 'success' in data,
            successValue: data.success,
            hasClients: 'clients' in data,
            clientsType: typeof data.clients,
            isClientsArray: Array.isArray(data.clients)
          });
        }
      }
    }

    await logger.debug(LogComponent.API, "Wolf API call successful", {
      path,
      method: "GET",
      userId: session.user.id,
      statusCode: response.statusCode,
    });

    return NextResponse.json(response.data);
  } catch (error) {
    await logger.error(LogComponent.API, "Wolf API GET request failed", error, {
      path,
      method: "GET",
    });
    return NextResponse.json(
      {
        error: "Failed to call Wolf API",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = `/${params.path.join("/")}`;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      await logger.warn(LogComponent.API, "Wolf API access denied - no session", {
        path,
        method: "POST",
        url: request.url,
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await logger.debug(LogComponent.API, "Wolf API POST request", {
      path,
      method: "POST",
      userId: session.user.id,
      username: session.user.name,
    });

    // Validate endpoint
    let isValid: boolean;
    try {
      isValid = await isValidWolfEndpoint(path, "POST");
    } catch (validationError) {
      await logger.error(LogComponent.API, "Wolf API endpoint validation failed", validationError, {
        path,
        method: "POST",
        userId: session.user.id,
      });
      return NextResponse.json(
        {
          error: "Endpoint validation failed",
          details: validationError instanceof Error ? validationError.message : String(validationError),
        },
        { status: 500 }
      );
    }

    if (!isValid) {
      await logger.warn(LogComponent.API, "Wolf API invalid endpoint", {
        path,
        method: "POST",
        userId: session.user.id,
      });
      return NextResponse.json(
        { error: "Invalid endpoint or method" },
        { status: 400 }
      );
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (bodyError) {
      await logger.error(LogComponent.API, "Failed to parse request body", bodyError, {
        path,
        method: "POST",
        userId: session.user.id,
      });
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    // Use centralized socket service
    const socketService = SocketService.getInstance();
    const response = await socketService.callWolfApi(session, path, {
      method: "POST",
      body,
    });

    if (!response.success) {
      await logger.error(LogComponent.API, "Wolf API call failed", new Error(response.error || "Unknown error"), {
        path,
        method: "POST",
        userId: session.user.id,
        statusCode: response.statusCode,
      });
      return NextResponse.json(
        { error: response.error || "Wolf API call failed" },
        { status: response.statusCode || 500 }
      );
    }

    await logger.debug(LogComponent.API, "Wolf API call successful", {
      path,
      method: "POST",
      userId: session.user.id,
      statusCode: response.statusCode,
    });

    return NextResponse.json(response.data);
  } catch (error) {
    await logger.error(LogComponent.API, "Wolf API POST request failed", error, {
      path,
      method: "POST",
    });
    return NextResponse.json(
      {
        error: "Failed to call Wolf API",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Handle PUT requests
export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = `/${params.path.join("/")}`;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      await logger.warn(LogComponent.API, "Wolf API access denied - no session", {
        path,
        method: "PUT",
        url: request.url,
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await logger.debug(LogComponent.API, "Wolf API PUT request", {
      path,
      method: "PUT",
      userId: session.user.id,
      username: session.user.name,
    });

    // Validate endpoint
    let isValid: boolean;
    try {
      isValid = await isValidWolfEndpoint(path, "PUT");
    } catch (validationError) {
      await logger.error(LogComponent.API, "Wolf API endpoint validation failed", validationError, {
        path,
        method: "PUT",
        userId: session.user.id,
      });
      return NextResponse.json(
        {
          error: "Endpoint validation failed",
          details: validationError instanceof Error ? validationError.message : String(validationError),
        },
        { status: 500 }
      );
    }

    if (!isValid) {
      await logger.warn(LogComponent.API, "Wolf API invalid endpoint", {
        path,
        method: "PUT",
        userId: session.user.id,
      });
      return NextResponse.json(
        { error: "Invalid endpoint or method" },
        { status: 400 }
      );
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (bodyError) {
      await logger.error(LogComponent.API, "Failed to parse request body", bodyError, {
        path,
        method: "PUT",
        userId: session.user.id,
      });
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    // Use centralized socket service
    const socketService = SocketService.getInstance();
    const response = await socketService.callWolfApi(session, path, {
      method: "PUT",
      body,
    });

    if (!response.success) {
      await logger.error(LogComponent.API, "Wolf API call failed", new Error(response.error || "Unknown error"), {
        path,
        method: "PUT",
        userId: session.user.id,
        statusCode: response.statusCode,
      });
      return NextResponse.json(
        { error: response.error || "Wolf API call failed" },
        { status: response.statusCode || 500 }
      );
    }

    await logger.debug(LogComponent.API, "Wolf API call successful", {
      path,
      method: "PUT",
      userId: session.user.id,
      statusCode: response.statusCode,
    });

    return NextResponse.json(response.data);
  } catch (error) {
    await logger.error(LogComponent.API, "Wolf API PUT request failed", error, {
      path,
      method: "PUT",
    });
    return NextResponse.json(
      {
        error: "Failed to call Wolf API",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Handle DELETE requests
export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = `/${params.path.join("/")}`;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      await logger.warn(LogComponent.API, "Wolf API access denied - no session", {
        path,
        method: "DELETE",
        url: request.url,
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await logger.debug(LogComponent.API, "Wolf API DELETE request", {
      path,
      method: "DELETE",
      userId: session.user.id,
      username: session.user.name,
    });

    // Validate endpoint
    let isValid: boolean;
    try {
      isValid = await isValidWolfEndpoint(path, "DELETE");
    } catch (validationError) {
      await logger.error(LogComponent.API, "Wolf API endpoint validation failed", validationError, {
        path,
        method: "DELETE",
        userId: session.user.id,
      });
      return NextResponse.json(
        {
          error: "Endpoint validation failed",
          details: validationError instanceof Error ? validationError.message : String(validationError),
        },
        { status: 500 }
      );
    }

    if (!isValid) {
      await logger.warn(LogComponent.API, "Wolf API invalid endpoint", {
        path,
        method: "DELETE",
        userId: session.user.id,
      });
      return NextResponse.json(
        { error: "Invalid endpoint or method" },
        { status: 400 }
      );
    }

    // Use centralized socket service
    const socketService = SocketService.getInstance();
    const response = await socketService.callWolfApi(session, path, { method: "DELETE" });

    if (!response.success) {
      await logger.error(LogComponent.API, "Wolf API call failed", new Error(response.error || "Unknown error"), {
        path,
        method: "DELETE",
        userId: session.user.id,
        statusCode: response.statusCode,
      });
      return NextResponse.json(
        { error: response.error || "Wolf API call failed" },
        { status: response.statusCode || 500 }
      );
    }

    await logger.debug(LogComponent.API, "Wolf API call successful", {
      path,
      method: "DELETE",
      userId: session.user.id,
      statusCode: response.statusCode,
    });

    return NextResponse.json(response.data);
  } catch (error) {
    await logger.error(LogComponent.API, "Wolf API DELETE request failed", error, {
      path,
      method: "DELETE",
    });
    return NextResponse.json(
      {
        error: "Failed to call Wolf API",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
