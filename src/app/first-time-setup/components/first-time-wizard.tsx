"use client";

import { updateSteamSettings } from "@/app/settings/account/actions";
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
import { LogComponent } from "@/lib/logger";
import { clientLogger } from "@/lib/logger/client";
import { showToast } from "@/lib/toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
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
    setIsLoading(true);
    try {
      await updatePassword(data.newPassword);
      showToast.success("Password updated successfully");
      await clientLogger.info(
        LogComponent.AUTH,
        "Password updated successfully"
      );

      // Move to Steam step instead of signing out
      setCurrentStep("steam");
    } catch (error) {
      await clientLogger.error(
        LogComponent.AUTH,
        "Failed to update password",
        error instanceof Error ? error : new Error(String(error))
      );
      showToast.error(
        "Password Update Failed",
        error instanceof Error ? error : new Error("Failed to update password")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSteamSubmit = async (data: z.infer<typeof steamSchema>) => {
    setIsLoading(true);
    try {
      // Use the existing updateSteamSettings server action
      const result = await updateSteamSettings({
        steamId: data.steamId || "",
        steamApiKey: data.steamApiKey || "",
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to save Steam settings");
      }

      showToast.success("Steam settings saved successfully");
      await clientLogger.info(
        LogComponent.AUTH,
        "Steam settings saved successfully"
      );

      // Sign out and redirect to login after completing setup
      await signOut({ redirect: false });
      showToast.success("Setup completed successfully");
      router.replace("/login");
    } catch (error) {
      await clientLogger.error(
        LogComponent.AUTH,
        "Failed to save Steam settings",
        error instanceof Error ? error : new Error(String(error))
      );
      showToast.error(
        "Steam Settings Failed",
        error instanceof Error
          ? error
          : new Error("Failed to save Steam settings")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    setIsLoading(true);
    try {
      clientLogger.info(LogComponent.AUTH, "Skipping Steam setup");

      // Just sign out and redirect, no Steam settings to save
      await signOut({ redirect: false });
      showToast.success("Setup completed successfully");
      router.push("/login");
    } catch (error) {
      await clientLogger.error(
        LogComponent.AUTH,
        "Failed to complete setup",
        error instanceof Error ? error : new Error(String(error))
      );
      showToast.error(
        "Setup Failed",
        error instanceof Error ? error : new Error("Failed to complete setup")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = async () => {
    await clientLogger.debug(
      LogComponent.WOLF_UI,
      "Moving to next step in first-time setup",
      {
        currentStep: currentStep,
        nextStep: currentStep === "password" ? "steam" : "password",
      }
    );
    setCurrentStep((prev) => (prev === "password" ? "steam" : "password"));
  };

  const handleBack = async () => {
    await clientLogger.debug(
      LogComponent.WOLF_UI,
      "Moving to previous step in first-time setup",
      {
        currentStep: currentStep,
        previousStep: currentStep === "password" ? "steam" : "password",
      }
    );
    setCurrentStep((prev) => (prev === "password" ? "steam" : "password"));
  };

  const handleFinish = async () => {
    setIsLoading(true);
    try {
      await clientLogger.info(
        LogComponent.WOLF_UI,
        "Completing first-time setup"
      );
      router.push("/dashboard");
    } catch (error) {
      await clientLogger.error(
        LogComponent.AUTH,
        "Error completing first-time setup",
        error instanceof Error ? error : new Error(String(error))
      );
      showToast.error(
        "Setup Error",
        error instanceof Error
          ? error
          : new Error("An error occurred while completing the setup"),
        {
          description: "An error occurred while completing the setup",
        }
      );
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
                  type="button"
                  variant="outline"
                  onClick={handleSkip}
                  disabled={isLoading}
                >
                  Skip
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Complete Setup"}
                </Button>
              </CardFooter>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
