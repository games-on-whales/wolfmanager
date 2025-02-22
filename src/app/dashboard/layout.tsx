"use client";

import { LoadingSpinner } from "@/components/ui/loading";
import { clientLogger, LogComponent } from "@/lib/logger";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status, data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Log session status changes
    clientLogger.debug(LogComponent.WOLF_UI, "Dashboard session status", {
      status,
      userId: session?.user?.id,
    });

    if (status === "unauthenticated") {
      clientLogger.info(LogComponent.AUTH, "Unauthenticated access attempt", {
        redirectTo: "/login",
      });
      router.push("/login");
    }
  }, [status, router, session]);

  // Show loading spinner during initial load
  if (status === "loading") {
    clientLogger.debug(LogComponent.WOLF_UI, "Dashboard loading");
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Don't render anything if not authenticated
  if (status !== "authenticated") {
    return null;
  }

  return <>{children}</>;
}
