import { LoadingSpinner } from "@/components/ui/loading";

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <LoadingSpinner />
    </div>
  );
}
