"use client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { clientLogger, LogComponent } from "@/lib/logger";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

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

      toast.success("Logged in successfully");
      router.push("/dashboard");
      router.refresh();

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
        toast.error("Failed to check login status. Please try again.");
      }
    } catch (error) {
      clientLogger.error(LogComponent.AUTH, "Login failed", error);
      toast.error("Invalid username or password");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-6">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input
                  placeholder="username"
                  {...field}
                  disabled={isLoading}
                  autoComplete="username"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="••••••••"
                  {...field}
                  disabled={isLoading}
                  autoComplete="current-password"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Logging in..." : "Login"}
        </Button>
      </form>
    </Form>
  );
}
