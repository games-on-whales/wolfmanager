import { authOptions } from "@/lib/auth";
import { LogComponent, logger } from "@/lib/logger";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getServerSession(authOptions);

  await logger.info(
    LogComponent.WOLF_UI,
    "Root page accessed",
    {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      requiresFirstTimeSetup: session?.requiresFirstTimeSetup,
    }
  );

  // If user is authenticated, redirect to clients page
  if (session?.user) {
    await logger.info(
      LogComponent.WOLF_UI,
      "Redirecting authenticated user to clients page",
      {
        userId: session.user.id,
        requiresFirstTimeSetup: session.requiresFirstTimeSetup,
      }
    );
    redirect("/clients");
  }

  // If not authenticated, redirect to login without logging as it's expected behavior
  await logger.info(LogComponent.WOLF_UI, "No session found, redirecting to login");
  redirect("/login");
}
