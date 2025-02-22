"use client";

import { clientLogger, LogComponent } from "@/lib/logger";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

export function LogoutHandler() {
  const router = useRouter();

  useEffect(() => {
    async function handleLogout() {
      try {
        clientLogger.info(LogComponent.AUTH, "Logging out user");
        await signOut({ redirect: false });
        toast.success("Logged out successfully");
        router.push("/login");
        router.refresh();
      } catch (error) {
        clientLogger.error(LogComponent.AUTH, "Logout failed", error);
        toast.error("Failed to log out");
        router.push("/dashboard");
      }
    }

    handleLogout();
  }, [router]);

  return null;
}
