import { LoadingSpinner } from "@/components/ui/loading";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginClient } from "./components/login-client";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; callbackUrl?: string };
}) {
  const session = await getServerSession(authOptions);

  // If authenticated and no first-time setup needed, redirect to dashboard
  if (session?.user && !session.requiresFirstTimeSetup && !session.error) {
    redirect("/dashboard");
  }

  return (
    <div className="dark">
      <Suspense fallback={<LoadingSpinner />}>
        <LoginClient
          isFirstTimeSetup={session?.requiresFirstTimeSetup || false}
          initialSession={session}
          error={searchParams.error}
          callbackUrl={searchParams.callbackUrl}
        />
      </Suspense>
    </div>
  );
}
