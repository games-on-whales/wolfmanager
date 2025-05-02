import { authOptions } from "@/lib/auth";
import { LogComponent, logger } from "@/lib/logger";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getServerSession(authOptions);

  // If user is authenticated, redirect to clients page
  if (session?.user) {
    await logger.debug(
      LogComponent.WOLF_UI,
      "Redirecting authenticated user to clients page",
      {
        userId: session.user.id,
      }
    );
    redirect("/clients");
  }

  // If not authenticated, redirect to login without logging as it's expected behavior
  redirect("/login");
}
