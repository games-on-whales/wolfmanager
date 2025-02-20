import { authOptions } from "@/lib/auth";
import { changeUserPassword, loadConfig } from "@/lib/config";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { newPassword } = await request.json();
    const config = loadConfig();
    const user = Object.values(config.users).find(
      (u) => u.id === session.user.id
    );

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    changeUserPassword(user.username, newPassword);

    return NextResponse.json({
      success: true,
      requiresFirstTimeSetup: false,
    });
  } catch (error) {
    console.error("Password change error:", error);
    return NextResponse.json(
      { error: "Failed to change password" },
      { status: 500 }
    );
  }
}
