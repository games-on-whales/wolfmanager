"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { clientLogger } from "@/lib/logger/client";
import { LogComponent } from "@/lib/logger/types";
import {
  ArrowLeft,
  Home,
  LogIn,
  LucideIcon,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export type AccessDeniedVariant = "unauthorized" | "forbidden" | "expired";

type ActionType = {
  label: string;
  icon: LucideIcon;
} & ({ action: "back" } | { href: string });

interface VariantConfig {
  title: string;
  description: string;
  icon: LucideIcon;
  primaryAction: { label: string; href: string };
  secondaryAction: ActionType;
}

interface AccessDeniedProps {
  variant: AccessDeniedVariant;
  message?: string;
  metadata?: Record<string, any>;
}

const variantConfig: Record<AccessDeniedVariant, VariantConfig> = {
  unauthorized: {
    title: "Authentication Required",
    description: "Please log in to access this page.",
    icon: LogIn,
    primaryAction: {
      label: "Log In",
      href: "/login",
    },
    secondaryAction: {
      label: "Back",
      icon: ArrowLeft,
      action: "back",
    },
  },
  forbidden: {
    title: "Access Denied",
    description: "You do not have permission to access this page.",
    icon: ShieldAlert,
    primaryAction: {
      label: "Go Home",
      href: "/",
    },
    secondaryAction: {
      label: "Back",
      icon: ArrowLeft,
      action: "back",
    },
  },
  expired: {
    title: "Session Expired",
    description: "Your session has expired. Please log in again.",
    icon: RefreshCw,
    primaryAction: {
      label: "Log In Again",
      href: "/login",
    },
    secondaryAction: {
      label: "Go Home",
      icon: Home,
      href: "/",
    },
  },
};

export function AccessDenied({
  variant,
  message,
  metadata = {},
}: AccessDeniedProps) {
  const router = useRouter();
  const config = variantConfig[variant];

  // Log the access denied event on client-side only
  useEffect(() => {
    clientLogger.warn(LogComponent.AUTH, `Access denied: ${variant}`, {
      variant,
      customMessage: message,
      ...metadata,
    });
  }, [variant, message, metadata]);

  const handleSecondaryAction = () => {
    clientLogger.info(
      LogComponent.AUTH,
      `User initiated ${variant} secondary action`,
      { action: config.secondaryAction.label }
    );

    if (
      "action" in config.secondaryAction &&
      config.secondaryAction.action === "back"
    ) {
      router.back();
    } else if ("href" in config.secondaryAction) {
      router.push(config.secondaryAction.href);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <config.icon className="h-6 w-6 text-destructive" />
            <CardTitle>{config.title}</CardTitle>
          </div>
          <CardDescription>{message || config.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTitle>Access Restricted</AlertTitle>
            <AlertDescription>
              {variant === "unauthorized" &&
                "You need to be logged in to view this page."}
              {variant === "forbidden" &&
                "You don't have the required permissions."}
              {variant === "expired" &&
                "Your session has expired for security reasons."}
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={handleSecondaryAction}>
            <config.secondaryAction.icon className="mr-2 h-4 w-4" />
            {config.secondaryAction.label}
          </Button>
          <Link href={config.primaryAction.href} passHref>
            <Button>
              <config.icon className="mr-2 h-4 w-4" />
              {config.primaryAction.label}
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
