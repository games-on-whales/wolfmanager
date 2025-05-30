import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { isValidWolfEndpoint } from "../lib/schema.server";
import { callWolfApi } from "../lib/wolf-socket.server";

// This is a dynamic route that will handle all requests to /api/wolf/*
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = `/${params.path.join("/")}`;
  console.log("[WOLF_API_DEBUG] GET request started", {
    path,
    params: params.path,
    url: request.url,
    timestamp: new Date().toISOString(),
  });

  try {
    console.log("[WOLF_API_DEBUG] Checking authentication...");
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      console.log("[WOLF_API_DEBUG] Authentication failed - no session or user");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("[WOLF_API_DEBUG] Authentication successful", {
      username: session.user.name,
    });

    console.log("[WOLF_API_DEBUG] Starting endpoint validation...", {
      path,
      method: "GET",
    });
    
    let isValid: boolean;
    try {
      isValid = await isValidWolfEndpoint(path, "GET");
      console.log("[WOLF_API_DEBUG] Endpoint validation completed", {
        path,
        method: "GET",
        isValid,
      });
    } catch (validationError) {
      console.error("[WOLF_API_DEBUG] Endpoint validation failed with error", {
        path,
        method: "GET",
        error: validationError,
        errorMessage: validationError instanceof Error ? validationError.message : String(validationError),
        errorStack: validationError instanceof Error ? validationError.stack : undefined,
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
      console.log("[WOLF_API_DEBUG] Endpoint validation failed - invalid endpoint", {
        path,
        method: "GET",
      });
      return NextResponse.json(
        { error: "Invalid endpoint or method" },
        { status: 400 }
      );
    }

    console.log("[WOLF_API_DEBUG] Calling Wolf API...", {
      path,
      method: "GET",
    });
    const response = await callWolfApi(path, { method: "GET" });
    console.log("[WOLF_API_DEBUG] Wolf API call successful", {
      path,
      method: "GET",
      responseType: typeof response,
    });
    return NextResponse.json(response);
  } catch (error) {
    console.error("[WOLF_API_DEBUG] Overall request failed", {
      path,
      method: "GET",
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
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
  console.log("[WOLF_API_DEBUG] POST request started", {
    path,
    params: params.path,
    url: request.url,
    timestamp: new Date().toISOString(),
  });

  try {
    console.log("[WOLF_API_DEBUG] Checking authentication...");
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      console.log("[WOLF_API_DEBUG] Authentication failed - no session or user");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("[WOLF_API_DEBUG] Authentication successful", {
      username: session.user.name,
    });

    console.log("[WOLF_API_DEBUG] Starting endpoint validation...", {
      path,
      method: "POST",
    });
    
    let isValid: boolean;
    try {
      isValid = await isValidWolfEndpoint(path, "POST");
      console.log("[WOLF_API_DEBUG] Endpoint validation completed", {
        path,
        method: "POST",
        isValid,
      });
    } catch (validationError) {
      console.error("[WOLF_API_DEBUG] Endpoint validation failed with error", {
        path,
        method: "POST",
        error: validationError,
        errorMessage: validationError instanceof Error ? validationError.message : String(validationError),
        errorStack: validationError instanceof Error ? validationError.stack : undefined,
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
      console.log("[WOLF_API_DEBUG] Endpoint validation failed - invalid endpoint", {
        path,
        method: "POST",
      });
      return NextResponse.json(
        { error: "Invalid endpoint or method" },
        { status: 400 }
      );
    }

    console.log("[WOLF_API_DEBUG] Parsing request body...");
    let body;
    try {
      body = await request.json();
      console.log("[WOLF_API_DEBUG] Request body parsed successfully", {
        bodyType: typeof body,
        bodyKeys: body && typeof body === 'object' ? Object.keys(body) : undefined,
      });
    } catch (bodyError) {
      console.error("[WOLF_API_DEBUG] Failed to parse request body", {
        error: bodyError,
        errorMessage: bodyError instanceof Error ? bodyError.message : String(bodyError),
      });
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    console.log("[WOLF_API_DEBUG] Calling Wolf API...", {
      path,
      method: "POST",
    });
    const response = await callWolfApi(path, {
      method: "POST",
      body,
    });
    console.log("[WOLF_API_DEBUG] Wolf API call successful", {
      path,
      method: "POST",
      responseType: typeof response,
    });
    return NextResponse.json(response);
  } catch (error) {
    console.error("[WOLF_API_DEBUG] Overall request failed", {
      path,
      method: "POST",
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
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
  console.log("[WOLF_API_DEBUG] PUT request started", {
    path,
    params: params.path,
    url: request.url,
    timestamp: new Date().toISOString(),
  });

  try {
    console.log("[WOLF_API_DEBUG] Checking authentication...");
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      console.log("[WOLF_API_DEBUG] Authentication failed - no session or user");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("[WOLF_API_DEBUG] Authentication successful", {
      username: session.user.name,
    });

    console.log("[WOLF_API_DEBUG] Starting endpoint validation...", {
      path,
      method: "PUT",
    });
    
    let isValid: boolean;
    try {
      isValid = await isValidWolfEndpoint(path, "PUT");
      console.log("[WOLF_API_DEBUG] Endpoint validation completed", {
        path,
        method: "PUT",
        isValid,
      });
    } catch (validationError) {
      console.error("[WOLF_API_DEBUG] Endpoint validation failed with error", {
        path,
        method: "PUT",
        error: validationError,
        errorMessage: validationError instanceof Error ? validationError.message : String(validationError),
        errorStack: validationError instanceof Error ? validationError.stack : undefined,
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
      console.log("[WOLF_API_DEBUG] Endpoint validation failed - invalid endpoint", {
        path,
        method: "PUT",
      });
      return NextResponse.json(
        { error: "Invalid endpoint or method" },
        { status: 400 }
      );
    }

    console.log("[WOLF_API_DEBUG] Parsing request body...");
    let body;
    try {
      body = await request.json();
      console.log("[WOLF_API_DEBUG] Request body parsed successfully", {
        bodyType: typeof body,
        bodyKeys: body && typeof body === 'object' ? Object.keys(body) : undefined,
      });
    } catch (bodyError) {
      console.error("[WOLF_API_DEBUG] Failed to parse request body", {
        error: bodyError,
        errorMessage: bodyError instanceof Error ? bodyError.message : String(bodyError),
      });
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    console.log("[WOLF_API_DEBUG] Calling Wolf API...", {
      path,
      method: "PUT",
    });
    const response = await callWolfApi(path, {
      method: "PUT",
      body,
    });
    console.log("[WOLF_API_DEBUG] Wolf API call successful", {
      path,
      method: "PUT",
      responseType: typeof response,
    });
    return NextResponse.json(response);
  } catch (error) {
    console.error("[WOLF_API_DEBUG] Overall request failed", {
      path,
      method: "PUT",
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
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
  console.log("[WOLF_API_DEBUG] DELETE request started", {
    path,
    params: params.path,
    url: request.url,
    timestamp: new Date().toISOString(),
  });

  try {
    console.log("[WOLF_API_DEBUG] Checking authentication...");
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      console.log("[WOLF_API_DEBUG] Authentication failed - no session or user");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("[WOLF_API_DEBUG] Authentication successful", {
      username: session.user.name,
    });

    console.log("[WOLF_API_DEBUG] Starting endpoint validation...", {
      path,
      method: "DELETE",
    });
    
    let isValid: boolean;
    try {
      isValid = await isValidWolfEndpoint(path, "DELETE");
      console.log("[WOLF_API_DEBUG] Endpoint validation completed", {
        path,
        method: "DELETE",
        isValid,
      });
    } catch (validationError) {
      console.error("[WOLF_API_DEBUG] Endpoint validation failed with error", {
        path,
        method: "DELETE",
        error: validationError,
        errorMessage: validationError instanceof Error ? validationError.message : String(validationError),
        errorStack: validationError instanceof Error ? validationError.stack : undefined,
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
      console.log("[WOLF_API_DEBUG] Endpoint validation failed - invalid endpoint", {
        path,
        method: "DELETE",
      });
      return NextResponse.json(
        { error: "Invalid endpoint or method" },
        { status: 400 }
      );
    }

    console.log("[WOLF_API_DEBUG] Calling Wolf API...", {
      path,
      method: "DELETE",
    });
    const response = await callWolfApi(path, { method: "DELETE" });
    console.log("[WOLF_API_DEBUG] Wolf API call successful", {
      path,
      method: "DELETE",
      responseType: typeof response,
    });
    return NextResponse.json(response);
  } catch (error) {
    console.error("[WOLF_API_DEBUG] Overall request failed", {
      path,
      method: "DELETE",
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
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
