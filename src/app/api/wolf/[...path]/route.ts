import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { callWolfApi } from "../lib/wolf-socket";

// This is a dynamic route that will handle all requests to /api/wolf/*
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.name) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Convert path array to string and remove any empty segments
    const endpoint = `/${params.path.filter(Boolean).join("/")}`;

    // Get query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);

    // Forward the request to Wolf
    const response = await callWolfApi(endpoint, {
      method: "GET",
      ...(Object.keys(searchParams).length > 0 ? { body: searchParams } : {}),
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("[WOLF_API_PROXY_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.name) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Convert path array to string and remove any empty segments
    const endpoint = `/${params.path.filter(Boolean).join("/")}`;

    // Get request body
    const body = await request.json().catch(() => ({}));

    // Forward the request to Wolf
    const response = await callWolfApi(endpoint, {
      method: "POST",
      body,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("[WOLF_API_PROXY_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

// Handle PUT requests
export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.name) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const endpoint = `/${params.path.filter(Boolean).join("/")}`;
    const body = await request.json().catch(() => ({}));

    const response = await callWolfApi(endpoint, {
      method: "PUT",
      body,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("[WOLF_API_PROXY_PUT]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

// Handle DELETE requests
export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.name) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const endpoint = `/${params.path.filter(Boolean).join("/")}`;
    const body = await request.json().catch(() => ({}));

    const response = await callWolfApi(endpoint, {
      method: "DELETE",
      body,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("[WOLF_API_PROXY_DELETE]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
