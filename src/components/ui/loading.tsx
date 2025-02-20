"use client";

export function LoadingSpinner() {
  return (
    <div
      className="fixed inset-0 bg-background flex items-center justify-center z-[99999]"
      aria-hidden="true"
    >
      <div className="relative w-16 h-16">
        <div className="absolute w-16 h-16 border-4 border-primary rounded-full opacity-100 border-t-transparent animate-spin" />
      </div>
    </div>
  );
}
