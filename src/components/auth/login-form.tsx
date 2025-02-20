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
import { useToast } from "@/components/ui/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
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
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (isLoading) return;

    try {
      setIsLoading(true);

      const result = await signIn("credentials", {
        username: values.username,
        password: values.password,
        redirect: false,
      });

      console.log("Sign-in result:", result);

      if (result?.error) {
        console.log("Sign-in error:", result.error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Invalid credentials",
        });
        setIsLoading(false);
        return;
      }

      // Reset form
      form.reset();

      // Show success toast
      toast({
        title: "Success",
        description: "Logged in successfully",
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
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to check login status. Please try again.",
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred during login",
      });
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
