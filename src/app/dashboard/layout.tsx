"use client";

import { LoadingSpinner } from "@/components/ui/loading";
import { LogComponent } from "@/lib/logger";
import { clientLogger } from "@/lib/logger/client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status, data: session } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const logStatus = async () => {
      if (status === "loading") {
        await clientLogger.debug(LogComponent.WOLF_UI, "Dashboard loading");
      } else {
        await clientLogger.debug(
          LogComponent.WOLF_UI,
          "Dashboard session status",
          {
            status,
            userId: session?.user?.id,
          }
        );

        if (status === "unauthenticated") {
          await clientLogger.info(
            LogComponent.AUTH,
            "Unauthenticated access attempt",
            {
              redirectTo: "/login",
            }
          );
          router.push("/login");
        }
      }
      setIsLoading(status === "loading");
    };

    logStatus();
  }, [status, router, session]);

  // Show loading spinner during initial load
  if (isLoading) {
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
