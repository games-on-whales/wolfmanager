"use client";

import { LogComponent } from "@/lib/logger";
import { clientLogger } from "@/lib/logger/client";
import { showToast } from "@/lib/toast";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function LogoutHandler() {
  const router = useRouter();

  useEffect(() => {
    const handleLogout = async () => {
      try {
        await clientLogger.info(LogComponent.AUTH, "User logging out");
        await signOut({ redirect: false });
        await clientLogger.debug(LogComponent.AUTH, "Logout successful");
        showToast.success("Logged Out", {
          description: "You have been successfully logged out",
        });
        router.push("/login");
      } catch (error) {
        console.error("LogoutHandler: Error during logout:", error);
        await clientLogger.error(
          LogComponent.AUTH,
          "Logout failed",
          error as Error
        );
        showToast.error("Logout Failed", error as Error, {
          description: "An error occurred while logging out",
        });
        router.push("/login");
      }
    };

    handleLogout();
  }, [router]);

  return null;
}
