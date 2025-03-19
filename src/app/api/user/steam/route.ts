import { authOptions } from "@/lib/auth";
import {
  loadConfig,
  updateUserSteamInfo,
  verifyUserSteamCredentials,
} from "@/lib/config";
import { LogComponent, logger } from "@/lib/logger";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

function maskString(str: string): string {
  if (!str) return "";
  const firstFour = str.slice(0, 4);
  const lastFour = str.slice(-4);
  return `${firstFour}${"*".repeat(Math.max(0, str.length - 8))}${lastFour}`;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.name) {
      await logger.warn(
        LogComponent.AUTH,
        "Unauthorized attempt to access Steam settings"
      );
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const config = loadConfig(true); // Load with decryption
    const user = config.users[session.user.name];

    if (!user) {
      await logger.warn(LogComponent.STEAM, "User not found in config", {
        username: session.user.name,
      });
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    await logger.debug(LogComponent.STEAM, "Retrieved Steam settings", {
      username: session.user.name,
      hasSteamId: !!user.steam_id,
      hasSteamApiKey: !!user.steam_api_key,
    });

    return NextResponse.json({
      hasSteamId: !!user.steam_id,
      hasSteamApiKey: !!user.steam_api_key,
    });
  } catch (error) {
    await logger.error(
      LogComponent.STEAM,
      "Error retrieving Steam settings",
      error instanceof Error ? error : new Error(String(error))
    );
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.name) {
      await logger.warn(
        LogComponent.AUTH,
        "Unauthorized attempt to update Steam settings"
      );
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    const { username, steamId, apiKey } = data;

    if (!username || !steamId || !apiKey) {
      await logger.warn(
        LogComponent.STEAM,
        "Missing required fields for Steam update",
        {
          username,
          hasSteamId: !!steamId,
          hasApiKey: !!apiKey,
        }
      );
      return NextResponse.json(
        { message: "All fields are required" },
        { status: 400 }
      );
    }

    // Verify the username matches the session user
    if (username !== session.user.name) {
      await logger.warn(
        LogComponent.AUTH,
        "Username mismatch in Steam update",
        {
          sessionUser: session.user.name,
          requestedUser: username,
        }
      );
      return NextResponse.json(
        { message: "Invalid user credentials" },
        { status: 403 }
      );
    }

    try {
      // Update the user's Steam information in TOML
      updateUserSteamInfo(username, steamId, apiKey);

      await logger.info(
        LogComponent.STEAM,
        "Steam settings updated successfully",
        {
          username,
          steamId: maskString(steamId),
        }
      );

      return NextResponse.json({
        message: "Steam settings updated successfully",
      });
    } catch (error) {
      await logger.error(
        LogComponent.STEAM,
        "Failed to update Steam settings in TOML",
        error instanceof Error ? error : new Error(String(error)),
        { username }
      );
      return NextResponse.json(
        { message: "Failed to update Steam settings" },
        { status: 500 }
      );
    }
  } catch (error) {
    await logger.error(
      LogComponent.STEAM,
      "Error processing Steam settings update request",
      error instanceof Error ? error : new Error(String(error))
    );
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.name) {
      await logger.warn(
        LogComponent.AUTH,
        "Unauthorized attempt to verify Steam credentials"
      );
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const data = await req.json();
    const { username, steamId, steamApiKey } = data;

    if (!username || !steamId || !steamApiKey) {
      await logger.warn(
        LogComponent.STEAM,
        "Missing required fields for Steam verification",
        {
          username,
          hasSteamId: !!steamId,
          hasSteamApiKey: !!steamApiKey,
        }
      );
      return new NextResponse("All fields are required", { status: 400 });
    }

    // Verify the credentials
    const isValid = verifyUserSteamCredentials(username, steamId, steamApiKey);

    await logger.info(
      LogComponent.STEAM,
      "Steam credentials verification completed",
      {
        username,
        isValid,
        steamId: maskString(steamId),
      }
    );

    return NextResponse.json({ isValid });
  } catch (error) {
    await logger.error(
      LogComponent.STEAM,
      "Error verifying Steam credentials",
      error instanceof Error ? error : new Error(String(error))
    );
    return new NextResponse("Internal error", { status: 500 });
  }
}
