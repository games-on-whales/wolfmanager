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
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const path = `/${params.path.join("/")}`;
  if (!(await isValidWolfEndpoint(path, "GET"))) {
    return NextResponse.json(
      { error: "Invalid endpoint or method" },
      { status: 400 }
    );
  }

  try {
    const response = await callWolfApi(path, { method: "GET" });
    return NextResponse.json(response);
  } catch (error) {
    console.error("[WOLF_API] Error:", error);
    return NextResponse.json(
      { error: "Failed to call Wolf API" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const path = `/${params.path.join("/")}`;
  if (!(await isValidWolfEndpoint(path, "POST"))) {
    return NextResponse.json(
      { error: "Invalid endpoint or method" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const response = await callWolfApi(path, {
      method: "POST",
      body,
    });
    return NextResponse.json(response);
  } catch (error) {
    console.error("[WOLF_API] Error:", error);
    return NextResponse.json(
      { error: "Failed to call Wolf API" },
      { status: 500 }
    );
  }
}

// Handle PUT requests
export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const path = `/${params.path.join("/")}`;
  if (!(await isValidWolfEndpoint(path, "PUT"))) {
    return NextResponse.json(
      { error: "Invalid endpoint or method" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const response = await callWolfApi(path, {
      method: "PUT",
      body,
    });
    return NextResponse.json(response);
  } catch (error) {
    console.error("[WOLF_API] Error:", error);
    return NextResponse.json(
      { error: "Failed to call Wolf API" },
      { status: 500 }
    );
  }
}

// Handle DELETE requests
export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const path = `/${params.path.join("/")}`;
  if (!(await isValidWolfEndpoint(path, "DELETE"))) {
    return NextResponse.json(
      { error: "Invalid endpoint or method" },
      { status: 400 }
    );
  }

  try {
    const response = await callWolfApi(path, { method: "DELETE" });
    return NextResponse.json(response);
  } catch (error) {
    console.error("[WOLF_API] Error:", error);
    return NextResponse.json(
      { error: "Failed to call Wolf API" },
      { status: 500 }
    );
  }
}
