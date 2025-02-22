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
import { useToast } from "@/components/ui/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

const steps = [
  {
    id: "password",
    title: "Change Password",
    description: "Please change your password to continue",
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
  const [currentStep, setCurrentStep] = useState(0);
  const { toast } = useToast();
  const router = useRouter();

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

  const onPasswordSubmit = async (values: PasswordForm) => {
    try {
      console.log("Starting password change submission");
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ newPassword: values.newPassword }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error || `Failed to change password: ${response.statusText}`
        );
      }

      toast({
        title: "Password Changed",
        description: "Your password has been updated successfully.",
      });

      // Move to next step
      setCurrentStep((prev) => prev + 1);
    } catch (error) {
      console.error("Password change error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to change password",
      });
    }
  };

  const onSteamSubmit = async (values: SteamForm) => {
    try {
      // Only update Steam settings if both fields are provided
      if (values.steamId && values.steamApiKey) {
        const response = await fetch("/api/user/steam", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            steamId: values.steamId,
            steamApiKey: values.steamApiKey,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || "Failed to update Steam settings");
        }

        toast({
          title: "Steam Settings Updated",
          description: "Your Steam account has been connected successfully.",
        });
      }

      // Complete setup and sign out
      console.log("Completing first-time setup");
      try {
        await signOut({ redirect: false });
        console.log("Sign out successful");
        router.push("/login");
      } catch (error) {
        console.error("Error during sign out:", error);
        router.push("/login");
      }
    } catch (error) {
      console.error("Steam settings error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update Steam settings",
      });
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>{steps[currentStep].title}</CardTitle>
        <CardDescription>{steps[currentStep].description}</CardDescription>
      </CardHeader>
      <CardContent>
        {currentStep === 0 && (
          <Form {...passwordForm}>
            <form
              onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
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
                <Button type="submit" className="ml-auto">
                  Next
                </Button>
              </CardFooter>
            </form>
          </Form>
        )}

        {currentStep === 1 && (
          <Form {...steamForm}>
            <form
              onSubmit={steamForm.handleSubmit(onSteamSubmit)}
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
                  onClick={() => {
                    // Skip Steam setup
                    onSteamSubmit({});
                  }}
                >
                  Skip
                </Button>
                <Button
                  type="submit"
                  disabled={
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
