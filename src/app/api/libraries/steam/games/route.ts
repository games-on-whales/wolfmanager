import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { LogComponent } from "@/lib/logger/types";
import { getUserSteamCredentials } from "@/lib/steam/config";
import { getOwnedGames } from "@/lib/steam/service";
import { GetGamesResponse } from "@/lib/steam/types";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      logger.warn(
        LogComponent.AUTH,
        "Unauthorized attempt to access Steam games"
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

    logger.debug(LogComponent.SYSTEM, "Fetching Steam credentials", undefined, {
      userId: session.user.id,
    });

    // Get user's Steam credentials from TOML config
    const credentials = getUserSteamCredentials(session.user.id);
    if (!credentials) {
      logger.warn(
        LogComponent.SYSTEM,
        "Steam credentials not found",
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

    const startTime = Date.now();
    const games = await getOwnedGames(credentials);
    const responseTime = Date.now() - startTime;

    logger.info(
      LogComponent.SYSTEM,
      "Successfully retrieved Steam games",
      undefined,
      {
        userId: session.user.id,
        gameCount: games.game_count,
        responseTime,
      }
    );

    const response: GetGamesResponse = {
      success: true,
      data: games,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error(LogComponent.SYSTEM, "Error fetching Steam games", error);

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
