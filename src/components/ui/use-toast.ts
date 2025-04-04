import { toast } from "sonner";

interface ToastOptions {
  title: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
}

export function useToast() {
  const showToast = ({
    title,
    description,
    variant = "default",
  }: ToastOptions) => {
    switch (variant) {
      case "destructive":
        toast.error(title, { description });
        break;
      case "success":
        toast.success(title, { description });
        break;
      default:
        toast(title, { description });
    }
  };

  return { toast: showToast };
}
