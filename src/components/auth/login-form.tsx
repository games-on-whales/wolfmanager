"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogComponent } from "@/lib/logger";
import { clientLogger } from "@/lib/logger/client";
import { showToast } from "@/lib/toast";
import { signIn } from "next-auth/react";
import { useState } from "react";

interface LoginFormProps {}

export function LoginForm({}: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    try {
      await clientLogger.debug(LogComponent.AUTH, "Attempting login", {
        username,
      });

      const result = await signIn("credentials", {
        username,
        password,
        callbackUrl: "/dashboard",
        redirect: true,
      });

      // The code won't reach here due to redirect: true
      // NextAuth will handle the redirect
    } catch (error) {
      await clientLogger.error(
        LogComponent.AUTH,
        "Login error",
        error as Error
      );
      showToast.error("Login Error", "An unexpected error occurred");
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
