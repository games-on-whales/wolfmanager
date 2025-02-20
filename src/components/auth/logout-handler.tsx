"use client";

import { useToast } from "@/components/ui/use-toast";
import { signOut } from "next-auth/react";

interface LogoutHandlerProps {
  children: React.ReactNode;
}

export function LogoutHandler({ children }: LogoutHandlerProps) {
  const { toast } = useToast();

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();

    try {
      // First clear any client-side storage
      localStorage.clear();
      sessionStorage.clear();

      // Sign out without redirect
      await signOut({ redirect: false });

      toast({
        title: "Success",
        description: "Logged out successfully",
      });

      // Force a full page reload to clear all state
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to logout. Please try again.",
      });
      // Even on error, force a reload to ensure clean state
      window.location.href = "/login";
    }
  };

  return (
    <div onClick={handleLogout} role="button" tabIndex={0}>
      {children}
    </div>
  );
}
