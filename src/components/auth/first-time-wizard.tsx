"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  // Add more steps here as needed
  // {
  //   id: "profile",
  //   title: "Complete Profile",
  //   description: "Fill in your profile information",
  // },
];

const passwordSchema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

interface FirstTimeWizardProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function FirstTimeWizard({ isOpen, onComplete }: FirstTimeWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof passwordSchema>) => {
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
        console.error("Password change failed:", {
          status: response.status,
          data,
        });
        throw new Error(
          data.error || `Failed to change password: ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log("Password change successful:", data);

      toast({
        title: "Success",
        description:
          "Password changed successfully. Please log in again with your new password.",
      });

      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        console.log("Completing first-time setup");
        // First call onComplete to update parent state
        onComplete();

        // Then sign out
        console.log("Signing out...");
        try {
          await signOut({ redirect: false });
          console.log("Sign out successful");

          // Finally redirect
          console.log("Redirecting to login page");
          window.location.href = "/login";
        } catch (error) {
          console.error("Error during sign out:", error);
          // Even if sign out fails, force a redirect
          window.location.href = "/login";
        }
      }
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

  // Prevent closing the dialog by clicking outside or pressing escape
  const onOpenChange = () => {
    // Do nothing - dialog cannot be closed
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{steps[currentStep].title}</DialogTitle>
          <DialogDescription>
            {steps[currentStep].description}
          </DialogDescription>
        </DialogHeader>

        {steps[currentStep].id === "password" && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
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
                control={form.control}
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
              <DialogFooter>
                <Button type="submit">
                  {currentStep === steps.length - 1 ? "Complete" : "Next"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}

        {/* Add more step content here as needed */}
      </DialogContent>
    </Dialog>
  );
}
