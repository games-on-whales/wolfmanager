"use client";

import type React from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogComponent } from "@/lib/logger";
import { clientLogger } from "@/lib/logger/client";
import { showToast } from "@/lib/toast";
import { GamepadIcon as GameController } from "lucide-react";
import { signIn } from "next-auth/react";
import { useState } from "react";

interface LoginFormProps {}

export function LoginForm({}: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  // Keep the existing onSubmit function and its logic
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
        redirect: true,
        callbackUrl: "/clients",
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
    <Card className="glass-card border-none">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center mb-2">
          <GameController className="h-12 w-12 text-[#00E5CC]" />
        </div>
        <CardTitle className="text-2xl font-bold text-white neon-text">
          Wolf Game Manager
        </CardTitle>
        <CardDescription className="text-gray-400">
          Enter your credentials to access your dashboard
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit}>
          {" "}
          {/* Keep the onSubmit handler */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-[#fffb96]">
                Username
              </Label>
              <Input
                id="username"
                name="username"
                placeholder="admin"
                type="text"
                required
                disabled={isLoading}
                autoComplete="username"
                className="bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-white placeholder:text-gray-500 neon-border" // Add classes
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[#fffb96]">
                  {" "}
                  {/* Change htmlFor and text */}
                  Password
                </Label>
                {/* Add Forgot password link */}
                <Button variant="link" className="px-0 text-xs text-[#01cdfe]">
                  Forgot password?
                </Button>
              </div>
              <Input
                id="password"
                name="password"
                placeholder="••••••••"
                type="password"
                required
                disabled={isLoading} // Keep disabled state
                autoComplete="current-password"
                className="bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-white placeholder:text-gray-500 neon-border" // Add classes
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-[#0077B6] hover:bg-[#0077B6]/80 text-white"
              disabled={isLoading}
            >
              {" "}
              {/* Add classes and keep disabled state */}
              {isLoading ? "Signing in..." : "Sign in"}{" "}
              {/* Keep loading text */}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
