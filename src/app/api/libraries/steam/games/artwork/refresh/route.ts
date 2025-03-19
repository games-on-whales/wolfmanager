import { authOptions } from "@/lib/auth";
import { LogComponent, logger } from "@/lib/logger";
import { getUserSteamCredentials } from "@/lib/steam/config";
import { getOwnedGames, refreshGameArtwork } from "@/lib/steam/service";
import { RefreshArtworkResponse } from "@/lib/steam/types";
import { validateSteamCredentials } from "@/lib/steam/validation";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      await logger.warn(
        LogComponent.AUTH,
        "Unauthorized attempt to refresh artwork"
      );
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Unauthorized",
            code: "UNAUTHORIZED",
          },
        },
        { status: 401 }
      );
    }

    await logger.debug(
      LogComponent.STEAM,
      "Fetching Steam credentials for artwork refresh",
      {
        userId: session.user.id,
      }
    );

    // Get user's Steam credentials from TOML config
    const credentials = getUserSteamCredentials(session.user.id);
    if (!credentials) {
      await logger.warn(
        LogComponent.STEAM,
        "Steam credentials not found for artwork refresh",
        {
          userId: session.user.id,
        }
      );
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Steam credentials not found",
            code: "STEAM_CREDENTIALS_NOT_FOUND",
          },
        },
        { status: 404 }
      );
    }

    // Validate credentials
    try {
      validateSteamCredentials(credentials);
    } catch (error) {
      await logger.warn(LogComponent.STEAM, "Invalid Steam credentials", {
        userId: session.user.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json(
        {
          success: false,
          error: {
            message:
              error instanceof Error ? error.message : "Invalid credentials",
            code: "INVALID_CREDENTIALS",
          },
        },
        { status: 400 }
      );
    }

    // Get user's games
    await logger.debug(
      LogComponent.STEAM,
      "Fetching games for artwork refresh",
      {
        userId: session.user.id,
      }
    );

    const { games } = await getOwnedGames(credentials);

    // Track progress
    let processed = 0;
    const total = games.length;

    await logger.info(LogComponent.STEAM, "Starting artwork refresh process", {
      userId: session.user.id,
      totalGames: total,
    });

    // Start the refresh process
    const startTime = Date.now();
    await refreshGameArtwork(games, async (p, t) => {
      processed = p;
      await logger.debug(LogComponent.STEAM, "Artwork refresh progress", {
        userId: session.user.id,
        processed: p,
        total: t,
        percentComplete: `${((p / t) * 100).toFixed(1)}%`,
      });
    });
    const responseTime = Date.now() - startTime;

    await logger.info(LogComponent.STEAM, "Completed artwork refresh", {
      userId: session.user.id,
      processed,
      total,
      responseTime,
      successRate: `${((processed / total) * 100).toFixed(1)}%`,
    });

    const response: RefreshArtworkResponse = {
      success: true,
      data: {
        processed,
        total,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    await logger.error(
      LogComponent.STEAM,
      "Error refreshing artwork",
      error instanceof Error ? error : new Error(String(error))
    );

    if (error instanceof Error) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: error.message,
            code: "STEAM_API_ERROR",
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          message: "An unexpected error occurred",
          code: "INTERNAL_SERVER_ERROR",
        },
      },
      { status: 500 }
    );
  }
}
