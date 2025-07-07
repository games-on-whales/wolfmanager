import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { getExternalBaseUrl } from "@/lib/url-resolver";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Add more utility functions as needed
export function formatDate(input: string | number): string {
  const date = new Date(input);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function absoluteUrl(path: string) {
  return `${getExternalBaseUrl()}${path}`;
}
