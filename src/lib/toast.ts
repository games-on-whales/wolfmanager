import { toast } from "sonner";

interface ToastOptions {
  description?: string;
  duration?: number;
}

const DEFAULT_DURATION = 5000;
const ERROR_DURATION = 7000;

export const showToast = {
  success: (title: string, options?: ToastOptions) => {
    toast.success(title, {
      duration: DEFAULT_DURATION,
      ...options,
    });
  },

  error: (title: string, error?: Error | string, options?: ToastOptions) => {
    const description = error
      ? typeof error === "string"
        ? error
        : error.message || "An unexpected error occurred"
      : options?.description;

    toast.error(title, {
      duration: ERROR_DURATION,
      description,
      ...options,
    });
  },

  info: (title: string, options?: ToastOptions) => {
    toast.info(title, {
      duration: DEFAULT_DURATION,
      ...options,
    });
  },

  warning: (title: string, options?: ToastOptions) => {
    toast.warning(title, {
      duration: DEFAULT_DURATION,
      ...options,
    });
  },
};
