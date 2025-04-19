"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LoadingSpinner } from "@/components/ui/loading";
import { Settings, User } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Prefetch the login page
  useEffect(() => {
    router.prefetch("/login");
  }, [router]);

  // Don't render anything during auth state changes
  if (status === "loading") {
    return null;
  }

  // Don't render the header if not authenticated
  if (status !== "authenticated") {
    return null;
  }

  const isActive = (path: string) => pathname === path;

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);

      // Clear any client-side storage
      localStorage.clear();
      sessionStorage.clear();

      // Sign out without redirect
      await signOut({ redirect: false });

      // Force a full page reload to clear all state
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout failed:", error);
      // Even on error, force a reload to ensure clean state
      window.location.href = "/login";
    }
  };

  return (
    <>
      {isLoggingOut && (
        <div className="transition-overlay">
          <LoadingSpinner />
        </div>
      )}
      <header
        className={`app-header border-b transition-opacity duration-300 ${
          isLoggingOut ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="container flex h-16 items-center justify-between py-4">
          <div className="flex items-center gap-6">
            <h2 className="text-lg font-semibold">WolfManager</h2>
            <nav className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className={`text-sm font-medium transition-colors hover:text-secondary ${
                  isActive("/dashboard") ? "text-secondary" : "text-white/70"
                }`}
              >
                Dashboard
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/settings">
              <Button
                variant="ghost"
                size="icon"
                className={`text-sm font-medium transition-colors hover:text-secondary ${
                  isActive("/settings") ? "text-secondary" : "text-white/70"
                }`}
              >
                <Settings className="h-5 w-5" />
                <span className="sr-only">Settings</span>
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:text-secondary"
                >
                  <User className="h-5 w-5" />
                  <span className="sr-only">User menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.push("/settings/account")}
                >
                  <User className="mr-2 h-4 w-4" />
                  Account Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
    </>
  );
}
