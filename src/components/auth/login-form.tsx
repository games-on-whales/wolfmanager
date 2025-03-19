"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogComponent } from "@/lib/logger";
import { clientLogger } from "@/lib/logger/client";
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
      await clientLogger.debug(LogComponent.AUTH, "Attempting login", {
        username,
      });

      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        await clientLogger.error(
          LogComponent.AUTH,
          "Login failed",
          new Error(result.error),
          {
            username,
          }
        );
        showToast.error("Login Failed", "Invalid username or password");
        return;
      }

      await clientLogger.info(LogComponent.AUTH, "Login successful", {
        username,
      });

      const isFirstLogin = username === "admin" && password === "admin";
      onSuccess(isFirstLogin);

      if (!isFirstLogin) {
        await clientLogger.debug(
          LogComponent.AUTH,
          "Redirecting to dashboard after login",
          {
            username,
          }
        );
        router.replace("/dashboard");
      } else {
        await clientLogger.debug(
          LogComponent.AUTH,
          "First-time login detected, showing wizard",
          {
            username,
          }
        );
        setIsLoading(false);
      }
    } catch (error) {
      await clientLogger.error(
        LogComponent.AUTH,
        "Login error",
        error as Error
      );
      showToast.error("Login Error", "An unexpected error occurred");
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
