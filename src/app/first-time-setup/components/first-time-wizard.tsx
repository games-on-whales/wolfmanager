"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { updatePassword } from "../actions";

const steps = [
  {
    id: "password",
    title: "Change Password",
    description: "Please set a new password to continue",
  },
  {
    id: "steam",
    title: "Steam Integration",
    description: "Connect your Steam account (optional)",
  },
] as const;

const passwordSchema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const steamSchema = z.object({
  steamId: z.string().optional(),
  steamApiKey: z.string().optional(),
});

type PasswordForm = z.infer<typeof passwordSchema>;
type SteamForm = z.infer<typeof steamSchema>;

export function FirstTimeWizard() {
  const [currentStep, setCurrentStep] = useState<"password" | "steam">(
    "password"
  );
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const steamForm = useForm<SteamForm>({
    resolver: zodResolver(steamSchema),
    defaultValues: {
      steamId: "",
      steamApiKey: "",
    },
  });

  const handlePasswordSubmit = async (data: z.infer<typeof passwordSchema>) => {
    try {
      clientLogger.info(
        LogComponent.AUTH,
        "Updating password in first-time setup"
      );
      setIsLoading(true);

      const result = await updatePassword(data.newPassword);

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success("Password updated successfully");
      clientLogger.info(
        LogComponent.AUTH,
        "Password updated successfully in first-time setup"
      );
      setCurrentStep("steam");
    } catch (error) {
      clientLogger.error(
        LogComponent.AUTH,
        "Failed to update password in first-time setup",
        error
      );
      toast.error(
        error instanceof Error ? error.message : "Failed to update password"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSteamSubmit = async (data: z.infer<typeof steamSchema>) => {
    try {
      clientLogger.info(LogComponent.AUTH, "Setting up Steam credentials");
      setIsLoading(true);

      const response = await fetch("/api/settings/steam", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          steamId: data.steamId || "",
          apiKey: data.steamApiKey || "",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save Steam settings");
      }

      toast.success("Setup completed successfully");
      clientLogger.info(LogComponent.AUTH, "First-time setup completed");

      // Sign out after completing setup
      await signOut({ redirect: false });
      router.push("/login");
    } catch (error) {
      clientLogger.error(
        LogComponent.AUTH,
        "Failed to save Steam settings",
        error
      );
      toast.error(
        error instanceof Error ? error.message : "Failed to save Steam settings"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    try {
      setIsLoading(true);
      clientLogger.info(LogComponent.AUTH, "Skipping Steam setup");

      // Just sign out and redirect, no Steam settings to save
      await signOut({ redirect: false });
      toast.success("Setup completed successfully");
      router.push("/login");
    } catch (error) {
      clientLogger.error(LogComponent.AUTH, "Failed to complete setup", error);
      toast.error("Failed to complete setup");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>
          {currentStep === "password" ? steps[0].title : steps[1].title}
        </CardTitle>
        <CardDescription>
          {currentStep === "password"
            ? steps[0].description
            : steps[1].description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {currentStep === "password" && (
          <Form {...passwordForm}>
            <form
              onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)}
              className="space-y-4"
            >
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <CardFooter className="px-0">
                <Button type="submit" className="ml-auto" disabled={isLoading}>
                  {isLoading ? "Updating..." : "Next"}
                </Button>
              </CardFooter>
            </form>
          </Form>
        )}

        {currentStep === "steam" && (
          <Form {...steamForm}>
            <form
              onSubmit={steamForm.handleSubmit(handleSteamSubmit)}
              className="space-y-4"
            >
              <Alert>
                <AlertDescription>
                  Steam integration is optional. You can skip this step and set
                  it up later in your account settings.
                </AlertDescription>
              </Alert>
              <FormField
                control={steamForm.control}
                name="steamId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Steam ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your Steam ID" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={steamForm.control}
                name="steamApiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Steam API Key</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter your Steam API Key"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <CardFooter className="px-0 flex justify-between">
                <Button
                  variant="outline"
                  type="button"
                  onClick={handleSkip}
                  disabled={isLoading}
                >
                  Skip
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isLoading ||
                    !steamForm.watch("steamId") ||
                    !steamForm.watch("steamApiKey")
                  }
                >
                  Complete Setup
                </Button>
              </CardFooter>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
