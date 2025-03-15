"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";
import "sonner/dist/styles.css";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      expand={true}
      richColors
      closeButton
      duration={5000}
      position="top-right"
      toastOptions={{
        className: "toast-custom",
        classNames: {
          toast:
            "group flex items-center gap-3 rounded-md p-4 text-foreground w-full border-2",
          title: "text-sm font-semibold [&+div]:mt-1",
          description: "text-sm text-muted-foreground",
          actionButton:
            "bg-primary text-primary-foreground text-xs px-2 py-1 rounded-md",
          cancelButton:
            "bg-muted text-muted-foreground text-xs px-2 py-1 rounded-md",
          success: "bg-success/10 border-success/30 text-success-foreground",
          error:
            "bg-destructive/10 border-destructive/30 text-destructive-foreground",
          warning: "bg-warning/10 border-warning/30 text-warning-foreground",
          info: "bg-info/10 border-info/30 text-info-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
