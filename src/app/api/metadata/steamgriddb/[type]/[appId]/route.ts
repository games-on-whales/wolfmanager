import { authOptions } from "@/lib/auth";
import { loadConfig } from "@/lib/config";
import { logger } from "@/lib/logger";
import { LogComponent } from "@/lib/logger/types";
import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
// Using global fetch instead of undici

// Constants
const STEAMGRIDDB_API_BASE = "https://www.steamgriddb.com/api/v2";

// Types
type ArtworkType = "grid" | "hero" | "logo";

interface RouteParams {
  params: {
    type: ArtworkType;
    appId: string;
  };
}

// GET /api/metadata/steamgriddb/[type]/[appId] - Get artwork metadata
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { type, appId } = params;

  if (!["grid", "hero", "logo"].includes(type)) {
    return NextResponse.json(
      { error: "Invalid artwork type" },
      { status: 400 }
    );
  }

  // Only admins or the task system should be able to access this endpoint
  const session = await getServerSession(authOptions);

  // For task system requests, we'll allow them without a session
  // but we should add some form of authentication in production
  const isTaskRequest = request.headers
    .get("User-Agent")
    ?.includes("WolfUI-Task");

  if (!isTaskRequest && (!session?.user || session.user.role !== "admin")) {
    logger.warn(
      LogComponent.API,
      `Unauthorized attempt to access SteamGridDB artwork endpoint for ${type}/${appId}`,
      null,
      { userId: session?.user?.id ?? "anonymous" }
    );
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Load config to get API key
    const config = loadConfig(true); // Decrypt needed for API key
    const apiKey = config.metadataProviders?.steamgridDb?.apiKey;

    if (!apiKey) {
      return NextResponse.json(
        { error: "SteamGridDB API key not configured" },
        { status: 400 }
      );
    }

    // Get query parameters
    const styles = request.nextUrl.searchParams.get("styles") || "official";
    // Only apply dimension filter for grids, and default to 600x900 if not specified
    const dimensions =
      type === "grid"
        ? request.nextUrl.searchParams.get("dimensions") || "600x900"
        : "";

    // --- Step 1: Get Internal SteamGridDB Game ID ---
    const gameLookupUrl = `${STEAMGRIDDB_API_BASE}/games/steam/${appId}`;
    logger.info(
      LogComponent.API,
      `Looking up internal game ID for Steam AppID ${appId}`,
      { userId: session?.user?.id ?? "task", url: gameLookupUrl }
    );

    const gameResponse = await fetch(gameLookupUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "WolfUI/1.0.0",
      },
    });

    if (!gameResponse.ok) {
      if (gameResponse.status === 404) {
        logger.warn(
          LogComponent.API,
          `Game with Steam AppID ${appId} not found on SteamGridDB.`,
          { userId: session?.user?.id ?? "task" }
        );
        return NextResponse.json({ success: false, data: [] }); // Mimic SGDB 'not found' for artwork
      }
      logger.error(
        LogComponent.API,
        `Failed to lookup game ID for Steam AppID ${appId}: ${gameResponse.status} ${gameResponse.statusText}`,
        null,
        { userId: session?.user?.id ?? "task" }
      );
      return NextResponse.json(
        { error: `SteamGridDB game lookup failed: ${gameResponse.status}` },
        { status: gameResponse.status }
      );
    }

    const gameData = await gameResponse.json();
    if (!gameData.success || !gameData.data || !gameData.data.id) {
      logger.warn(
        LogComponent.API,
        `Could not find internal game ID for Steam AppID ${appId} in SGDB response.`,
        { userId: session?.user?.id ?? "task", responseData: gameData }
      );
      return NextResponse.json({ success: false, data: [] });
    }
    const internalGameId = gameData.data.id;
    logger.info(
      LogComponent.API,
      `Found internal game ID ${internalGameId} for Steam AppID ${appId}`,
      { userId: session?.user?.id ?? "task" }
    );

    // --- Step 2: Fetch Artwork using Internal Game ID ---
    // Map our type to their endpoint pluralization (grid -> grids, hero -> heroes, etc.)
    const artworkEndpointMap: Record<ArtworkType, string> = {
      grid: "grids",
      hero: "heroes",
      logo: "logos",
    };
    const artworkTypePlural = artworkEndpointMap[type];
    if (!artworkTypePlural) {
      logger.error(
        LogComponent.API,
        `Unsupported artwork type requested: ${type}`,
        null,
        { userId: session?.user?.id ?? "task" }
      );
      return NextResponse.json(
        { error: "Invalid artwork type" },
        { status: 400 }
      );
    }

    // Re-add dimensions parameter
    let artworkUrl = `${STEAMGRIDDB_API_BASE}/${artworkTypePlural}/game/${internalGameId}`;
    if (dimensions) {
      artworkUrl += `?dimensions=${dimensions}`; // Start with ? as it's the first param
    }
    // Add other potential query params here if needed (mimes, types, nsfw, etc.)
    // if (styles) {
    //    artworkUrl += artworkUrl.includes('?') ? `&styles=${styles}` : `?styles=${styles}`; // Add & or ? accordingly
    // }
    // Add other potential query params here if needed (mimes, types, nsfw, etc.)

    logger.info(
      LogComponent.API,
      `Fetching ${type} artwork using internal ID ${internalGameId}`,
      { userId: session?.user?.id ?? "task", url: artworkUrl }
    );

    const response = await fetch(artworkUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "WolfUI/1.0.0",
      },
    });

    // Log the response status from SteamGridDB
    logger.info(
      LogComponent.API,
      `SteamGridDB API response status: ${response.status} ${response.statusText}`,
      {
        userId: session?.user?.id ?? "task",
        appId,
        type,
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        logger.info(
          LogComponent.API,
          `No ${type} artwork found for AppID ${appId} on SteamGridDB`,
          { userId: session?.user?.id ?? "task" }
        );
        // Return success: false as per SteamGridDB format for not found
        return NextResponse.json({ success: false, data: [] });
      }

      logger.error(
        LogComponent.API,
        `SteamGridDB API request failed for ${type} (${appId}): ${response.status} ${response.statusText}`,
        null,
        { userId: session?.user?.id ?? "task" }
      );

      // Forward the status code from SteamGridDB if possible
      return NextResponse.json(
        { error: `SteamGridDB API request failed: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Return the data from SteamGridDB
    return NextResponse.json(data);
  } catch (error) {
    // Enhanced error logging with more details
    logger.error(
      LogComponent.API,
      `Error fetching ${type} artwork for AppID ${appId}`,
      error instanceof Error ? error : new Error(String(error)),
      {
        userId: session?.user?.id ?? "task",
        errorDetails:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : String(error),
      }
    );

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
