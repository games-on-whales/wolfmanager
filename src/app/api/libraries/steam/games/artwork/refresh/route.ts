import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { LogComponent } from "@/lib/logger/types";
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
      logger.warn(LogComponent.AUTH, "Unauthorized attempt to refresh artwork");
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

    logger.debug(
      LogComponent.SYSTEM,
      "Fetching Steam credentials for artwork refresh",
      undefined,
      {
        userId: session.user.id,
      }
    );

    // Get user's Steam credentials from TOML config
    const credentials = getUserSteamCredentials(session.user.id);
    if (!credentials) {
      logger.warn(
        LogComponent.SYSTEM,
        "Steam credentials not found for artwork refresh",
        undefined,
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
      logger.warn(LogComponent.SYSTEM, "Invalid Steam credentials", undefined, {
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
    logger.debug(
      LogComponent.SYSTEM,
      "Fetching games for artwork refresh",
      undefined,
      {
        userId: session.user.id,
      }
    );

    const { games } = await getOwnedGames(credentials);

    // Track progress
    let processed = 0;
    const total = games.length;

    logger.info(
      LogComponent.SYSTEM,
      "Starting artwork refresh process",
      undefined,
      {
        userId: session.user.id,
        totalGames: total,
      }
    );

    // Start the refresh process
    const startTime = Date.now();
    await refreshGameArtwork(games, (p, t) => {
      processed = p;
      logger.debug(LogComponent.SYSTEM, "Artwork refresh progress", undefined, {
        userId: session.user.id,
        processed: p,
        total: t,
        percentComplete: `${((p / t) * 100).toFixed(1)}%`,
      });
    });
    const responseTime = Date.now() - startTime;

    logger.info(LogComponent.SYSTEM, "Completed artwork refresh", undefined, {
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
    logger.error(LogComponent.SYSTEM, "Error refreshing artwork", error);

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
