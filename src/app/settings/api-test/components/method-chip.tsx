"use client";

import { cn } from "@/lib/utils";

interface MethodChipProps {
  method: string;
  className?: string;
}

const methodColors = {
  GET: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  POST: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  PUT: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  PATCH:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
} as const;

export function MethodChip({ method, className }: MethodChipProps) {
  const colorClass =
    methodColors[method as keyof typeof methodColors] ||
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
        colorClass,
        method === "GET" && "ring-blue-700/10 dark:ring-blue-400/20",
        method === "POST" && "ring-green-700/10 dark:ring-green-400/20",
        method === "PUT" && "ring-amber-700/10 dark:ring-amber-400/20",
        method === "PATCH" && "ring-orange-700/10 dark:ring-orange-400/20",
        method === "DELETE" && "ring-red-700/10 dark:ring-red-400/20",
        className
      )}
    >
      {method}
    </span>
  );
}
