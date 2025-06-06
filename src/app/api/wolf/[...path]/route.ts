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
