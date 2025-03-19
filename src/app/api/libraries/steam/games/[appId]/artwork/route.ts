import { LogComponent, logger } from "@/lib/logger";
import { getGameArtwork } from "@/lib/steam/service";
import { GetArtworkResponse } from "@/lib/steam/types";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { appId: string } }
) {
  try {
    const appId = parseInt(params.appId);
    if (isNaN(appId) || appId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Invalid app ID",
            code: "INVALID_APP_ID",
          },
        },
        { status: 400 }
      );
    }

    await logger.debug(LogComponent.STEAM, "Fetching artwork", {
      appId,
    });

    const startTime = Date.now();
    const artwork = await getGameArtwork(appId);
    const responseTime = Date.now() - startTime;

    await logger.info(LogComponent.STEAM, "Successfully retrieved artwork", {
      appId,
      artworkCount: artwork.length,
      responseTime,
    });

    const response: GetArtworkResponse = {
      success: true,
      data: artwork,
    };

    return NextResponse.json(response);
  } catch (error) {
    await logger.error(
      LogComponent.STEAM,
      "Error fetching artwork",
      error instanceof Error ? error : new Error(String(error)),
      {
        appId: params.appId,
      }
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
