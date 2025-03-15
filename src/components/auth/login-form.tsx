"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogComponent, clientLogger } from "@/lib/logger";
import { showToast } from "@/lib/toast";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import * as z from "zod";

const formSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

interface LoginFormProps {
  onSuccess: (isFirstTimeLogin: boolean) => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    try {
      clientLogger.info(LogComponent.AUTH, "Attempting login", {
        username,
      });

      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (!result?.ok) {
        throw new Error(result?.error || "Failed to sign in");
      }

      clientLogger.info(LogComponent.AUTH, "Login successful", {
        username,
      });

      showToast.success("Login Successful", {
        description: "You have been successfully logged in",
      });

      try {
        // Get the session data directly from the API
        const response = await fetch("/api/auth/session");
        const sessionData = await response.json();
        console.log("Session data after login:", sessionData);

        // Check if this is a first-time login
        const isFirstTimeLogin = Boolean(sessionData?.requiresFirstTimeSetup);

        console.log("First-time login check:", {
          requiresFirstTimeSetup: sessionData?.requiresFirstTimeSetup,
          isFirstTimeLogin,
          rawSessionData: sessionData,
        });

        // Let the parent component handle the success
        console.log("Calling onSuccess with:", isFirstTimeLogin);
        onSuccess(isFirstTimeLogin);

        // Only redirect if not a first-time login
        if (!isFirstTimeLogin) {
          console.log("Not first-time login, redirecting to dashboard");
          // Use replace to avoid navigation stack issues
          router.replace("/dashboard");
        } else {
          console.log("First-time login detected, showing wizard");
          // Stay on the current page and let the wizard handle it
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error checking session:", error);
        setIsLoading(false);
        showToast.error(
          "Login Failed",
          "Failed to check login status. Please try again."
        );
      }
    } catch (error) {
      clientLogger.error(LogComponent.AUTH, "Login failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      showToast.error("Login Failed", "Invalid username or password");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          type="text"
          required
          disabled={isLoading}
          autoComplete="username"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          disabled={isLoading}
          autoComplete="current-password"
        />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Logging in..." : "Login"}
      </Button>
    </form>
  );
}
