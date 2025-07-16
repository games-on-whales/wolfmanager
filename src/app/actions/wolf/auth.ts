"use server";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { LogComponent, logger } from "@/lib/logger";

/**
 * Get authenticated session or return null if not authenticated
 * Used by all Wolf actions to ensure proper authentication
 */
export async function getAuthenticatedSession() {
  try {
    // Get headers to debug cookie issues
    const { headers } = await import('next/headers');
    const headersList = headers();
    const cookieHeader = headersList.get('cookie');
    
    const session = await getServerSession(authOptions);
    await logger.debug(LogComponent.WOLF_UI, "DIAGNOSIS: Wolf action authentication check", {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      userName: session?.user?.name,
      userRole: session?.user?.role,
      nextauthUrl: process.env.NEXTAUTH_URL,
      nodeEnv: process.env.NODE_ENV,
      hasCookieHeader: !!cookieHeader,
      cookieHeaderLength: cookieHeader?.length || 0,
      hasSessionToken: cookieHeader?.includes('next-auth.session-token') || false,
      timestamp: new Date().toISOString()
    });
    
    if (!session?.user) {
      await logger.warn(LogComponent.WOLF_UI, "Wolf action attempted without authentication");
      return null;
    }
    return session;
  } catch (error) {
    await logger.error(LogComponent.WOLF_UI, "DIAGNOSIS: Error in getAuthenticatedSession", error);
    return null;
  }
}