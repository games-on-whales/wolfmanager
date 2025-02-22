import { authOptions } from "@/lib/auth";
import { LogComponent, logger } from "@/lib/logger";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function RootPage() {
  try {
    const session = await getServerSession(authOptions);

    await logger.info(LogComponent.WOLF_UI, "Initial route check", {
      hasSession: !!session,
      requiresSetup: session?.requiresFirstTimeSetup,
    });

    if (session) {
      await logger.debug(LogComponent.WOLF_UI, "Redirecting to dashboard", {
        userId: session.user.id,
        username: session.user.name,
      });
      redirect("/dashboard");
    } else {
      await logger.debug(LogComponent.WOLF_UI, "Redirecting to login");
      redirect("/login");
    }
  } catch (error) {
    await logger.error(
      LogComponent.WOLF_UI,
      "Error during initial route check",
      error
    );
    throw error;
  }
}
