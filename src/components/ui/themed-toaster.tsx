"use client";

import { AlertCircle, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      expand={true}
      closeButton
      duration={5000}
      position="top-right"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group flex w-full items-start gap-3 rounded-md border p-4 text-sm shadow-lg",
          title: "text-base font-medium text-foreground",
          description: "text-sm text-muted-foreground",
          actionButton:
            "bg-primary text-primary-foreground rounded-md px-2 py-1 text-xs",
          cancelButton:
            "bg-muted text-muted-foreground rounded-md px-2 py-1 text-xs",
          closeButton:
            "absolute right-2 top-2 opacity-70 transition-opacity hover:opacity-100",
          success: "wolf-notification wolf-notification-success",
          error: "wolf-notification wolf-notification-error",
          warning: "wolf-notification wolf-notification-warning",
          info: "wolf-notification wolf-notification-info",
        },
      }}
      icons={{
        success: <CheckCircle className="h-5 w-5 text-green-400" />,
        error: <AlertCircle className="h-5 w-5 text-red-400" />,
        warning: <AlertTriangle className="h-5 w-5 text-yellow-400" />,
        info: <Info className="h-5 w-5 text-blue-400" />,
      }}
      {...props}
    />
  );
};

export { Toaster };
