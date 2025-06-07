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

type PasswordForm = z.infer<typeof passwordSchema>;

export function FirstTimeWizard() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const handleFinish = async () => {
    try {
      await clientLogger.info(
        LogComponent.WOLF_UI,
        "Completing first-time setup"
      );
      // Small delay to ensure session is updated, then use smooth navigation
      setTimeout(() => {
        router.push("/clients");
      }, 100);
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
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (data: z.infer<typeof passwordSchema>) => {
    setIsLoading(true);
    try {
      const result = await updatePassword(data.newPassword);
      if (!result.success) {
        throw new Error(result.error || "Failed to update password");
      }
      showToast.success("Password updated successfully");
      await clientLogger.info(
        LogComponent.AUTH,
        "Password updated successfully"
      );
      if (result.requiresRefresh) {
        // Session will be automatically updated by JWT callback, navigate normally
        await handleFinish();
      } else {
        await handleFinish();
      }
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

  return (
    <div className="flex justify-center items-center">
      <Card className="w-full max-w-lg glass-card border-none">
        <CardHeader>
          <CardTitle className="text-white">{steps[0].title}</CardTitle>
          <CardDescription className="text-gray-300">
            {steps[0].description}
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                    <FormLabel className="text-gray-300">New Password</FormLabel>
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
                    <FormLabel className="text-gray-300">
                      Confirm Password
                    </FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <CardFooter className="px-0 pt-4">
                <Button type="submit" className="ml-auto" disabled={isLoading}>
                  {isLoading ? "Updating..." : "Complete Setup"}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
