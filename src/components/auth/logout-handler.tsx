"use client";

import { clientLogger, LogComponent } from "@/lib/logger";
import { showToast } from "@/lib/toast";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function LogoutHandler() {
  const router = useRouter();

  useEffect(() => {
    async function handleLogout() {
      try {
        clientLogger.info(LogComponent.AUTH, "Logging out user");
        await signOut({ redirect: false });
        showToast.success("Logged out successfully", {
          description: "You have been successfully logged out of your account",
        });
        router.push("/login");
        router.refresh();
      } catch (error) {
        clientLogger.error(LogComponent.AUTH, "Logout failed", error);
        showToast.error("Failed to log out", error as Error);
        router.push("/dashboard");
      }
    }

    handleLogout();
  }, [router]);

  return null;
}
