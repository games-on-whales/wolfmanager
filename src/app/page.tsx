import { authOptions } from "@/lib/auth";
import { LogComponent, logger } from "@/lib/logger";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function Home() {
  // Check if user is authenticated
  await logger.info(LogComponent.WOLF_UI, "Initial route check", {
    path: "/",
  });

  const session = await getServerSession(authOptions);
  if (session?.user) {
    await logger.debug(LogComponent.WOLF_UI, "Redirecting to dashboard", {
      userId: session.user.id,
    });
    redirect("/dashboard");
  } else {
    await logger.debug(LogComponent.WOLF_UI, "Redirecting to login");
    redirect("/login");
  }

  // This is unreachable but required for TypeScript
  return null;
}
