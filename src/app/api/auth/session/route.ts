import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { logger, LogComponent } from "@/lib/logger";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    // Enhanced logging for debugging
    if (session) {
      logger.info(LogComponent.API, "Session found", { 
        hasUser: !!session.user,
        userId: session.user?.id,
        requiresFirstTimeSetup: session.requiresFirstTimeSetup,
        sessionError: session.error 
      });
    } else {
      logger.warn(LogComponent.API, "No session found during validation");
    }
    
    if (session?.user) {
      return NextResponse.json({ valid: true });
    }
    
    logger.warn(LogComponent.API, "Session validation failed - returning 401", { 
      hasSession: !!session,
      hasUser: !!session?.user 
    });
    return NextResponse.json({ valid: false }, { status: 401 });
  } catch (error) {
    logger.error(LogComponent.API, "Session revalidation failed", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}