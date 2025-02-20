import { authService } from "@/services/auth";
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

    // Update the user's profile
    await authService.updateUserProfile(session.user.id, {
      name: displayName,
    });

    return NextResponse.json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("[PROFILE_UPDATE]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
