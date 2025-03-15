import { loadConfig, saveConfig } from "@/lib/config";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const data = await req.json();
    const { displayName } = data;

    if (!displayName) {
      return new NextResponse("Display name is required", { status: 400 });
    }

    // Update the user's profile in config
    const config = loadConfig();
    const user = Object.values(config.users).find(
      (u) => u.id === session.user.id
    );

    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    user.display_name = displayName;
    user.updated_at = new Date().toISOString();
    saveConfig(config);

    return NextResponse.json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("[PROFILE_UPDATE]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
