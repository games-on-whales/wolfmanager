import { changeUserPassword, loadConfig } from "@/lib/config";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    const { currentPassword, newPassword } = data;
    const username = session.user.name;

    if (!username || !newPassword) {
      return NextResponse.json(
        { message: "Required fields are missing" },
        { status: 400 }
      );
    }

    // Load user configuration
    const config = loadConfig();
    const user = config.users[username];

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // If it's not first-time setup, verify current password
    if (!user.requiresFirstTimeSetup && currentPassword) {
      const isValidPassword = await bcrypt.compare(
        currentPassword,
        user.password_hash
      );
      if (!isValidPassword) {
        return NextResponse.json(
          { message: "Current password is incorrect" },
          { status: 401 }
        );
      }
    }

    // Change password using the config utility
    changeUserPassword(username, newPassword);

    return NextResponse.json({
      message: "Password updated successfully",
      requiresFirstTimeSetup: false,
    });
  } catch (error) {
    console.error("[PASSWORD_UPDATE]", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
