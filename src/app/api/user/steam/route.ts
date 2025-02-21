import { authOptions } from "@/lib/auth";
import {
  loadConfig,
  updateUserSteamInfo,
  verifyUserSteamCredentials,
} from "@/lib/config";
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
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const config = loadConfig(true); // Load with decryption
    const user = config.users[session.user.name];

    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    return NextResponse.json({
      hasSteamId: !!user.steam_id,
      hasSteamApiKey: !!user.steam_api_key,
      maskedSteamId: user.steam_id ? maskString(user.steam_id) : "",
      maskedSteamApiKey: user.steam_api_key
        ? maskString(user.steam_api_key)
        : "",
    });
  } catch (error) {
    console.error("[STEAM_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.name) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const data = await req.json();
    const { username, steamId, steamApiKey } = data;

    if (!username || !steamId || !steamApiKey) {
      return new NextResponse("All fields are required", { status: 400 });
    }

    // Update the user's Steam information
    updateUserSteamInfo(username, steamId, steamApiKey);

    return NextResponse.json({
      message: "Steam settings updated successfully",
    });
  } catch (error) {
    console.error("[STEAM_UPDATE]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.name) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const data = await req.json();
    const { username, steamId, steamApiKey } = data;

    if (!username || !steamId || !steamApiKey) {
      return new NextResponse("All fields are required", { status: 400 });
    }

    // Verify the credentials
    const isValid = verifyUserSteamCredentials(username, steamId, steamApiKey);

    return NextResponse.json({ isValid });
  } catch (error) {
    console.error("[STEAM_VERIFY]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
