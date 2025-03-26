import { authOptions } from "@/lib/auth";
import { LogComponent, logger } from "@/lib/logger";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getServerSession(authOptions);

  // If user is authenticated, redirect to dashboard
  if (session?.user) {
    await logger.debug(
      LogComponent.WOLF_UI,
      "Redirecting authenticated user to dashboard",
      {
        userId: session.user.id,
      }
    );
    redirect("/dashboard");
  }

  // If not authenticated, redirect to login without logging as it's expected behavior
  redirect("/login");
}
