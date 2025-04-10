import { authOptions } from "@/lib/auth";
import { loadConfig } from "@/lib/config";
import { logger } from "@/lib/logger";
import { LogComponent } from "@/lib/logger/types";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

// GET /api/metadata/steamgriddb/settings - Get SteamGridDB settings
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "admin") {
    logger.warn(
      LogComponent.API,
      "Unauthorized attempt to access SteamGridDB settings GET endpoint",
      null,
      { userId: session?.user?.id ?? "anonymous" }
    );
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    logger.debug(
      LogComponent.API,
      "Admin user accessing SteamGridDB settings GET endpoint",
      { userId: session.user.id }
    );
    // Load config without decrypting sensitive user data or the SGDB key itself
    const config = loadConfig(false);

    const steamGridDbConfig = config.metadataProviders?.steamgridDb;
    const isApiKeySet =
      !!steamGridDbConfig?.apiKey && steamGridDbConfig.apiKey.length > 0;
    const enabled = steamGridDbConfig?.enabled ?? false;

    logger.info(
      LogComponent.API,
      "Successfully retrieved SteamGridDB settings status",
      { userId: session.user.id, enabled, isApiKeySet }
    );

    return NextResponse.json({
      enabled,
      isApiKeySet,
    });
  } catch (error) {
    logger.error(
      LogComponent.API,
      "Error retrieving SteamGridDB settings",
      error instanceof Error ? error : new Error(String(error)),
      { userId: session?.user?.id }
    );
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// POST handler removed - functionality moved to Server Action
// src/app/settings/metadata-providers/actions.ts
