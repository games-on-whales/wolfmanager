import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { getWolfSchema } from "../lib/schema.server";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const schema = await getWolfSchema();
    return NextResponse.json(schema);
  } catch (error) {
    console.error("[WOLF_SCHEMA] Failed to load schema:", error);
    // Include more detailed error information in development
    const errorDetails =
      process.env.NODE_ENV === "development"
        ? { message: error instanceof Error ? error.message : String(error) }
        : undefined;

    return NextResponse.json(
      {
        error: "Failed to load Wolf API schema",
        details: errorDetails,
      },
      { status: 500 }
    );
  }
}
