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
      toastOptions={{
        className: "toast-custom",
        classNames: {
          toast:
            "group flex items-center gap-3 rounded-md p-4 text-foreground w-full",
          title: "text-sm font-semibold",
          description: "text-sm",
          actionButton:
            "bg-primary text-primary-foreground text-xs px-2 py-1 rounded-md",
          cancelButton:
            "bg-muted text-muted-foreground text-xs px-2 py-1 rounded-md",
          success:
            "data-[type=success]:bg-[#0D3817] data-[type=success]:text-white",
          error: "data-[type=error]:bg-[#3F0D0D] data-[type=error]:text-white",
          warning:
            "data-[type=warning]:bg-[#3F2D0D] data-[type=warning]:text-white",
          info: "data-[type=info]:bg-[#0D1B3F] data-[type=info]:text-white",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
