import { logger } from "@/lib/logger";
import { LogComponent } from "@/lib/logger/types";
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

    logger.debug(LogComponent.SYSTEM, "Fetching artwork", undefined, {
      appId,
    });

    const startTime = Date.now();
    const artwork = await getGameArtwork(appId);
    const responseTime = Date.now() - startTime;

    logger.info(
      LogComponent.SYSTEM,
      "Successfully retrieved artwork",
      undefined,
      {
        appId,
        artworkCount: artwork.length,
        responseTime,
      }
    );

    const response: GetArtworkResponse = {
      success: true,
      data: artwork,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error(LogComponent.SYSTEM, "Error fetching artwork", error, {
      appId: params.appId,
    });

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
