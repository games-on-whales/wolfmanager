import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface LoadingStateProps {
  type?: "default" | "table" | "form" | "minimal";
  count?: number;
}

export function LoadingState({
  type = "default",
  count = 2,
}: LoadingStateProps) {
  if (type === "table") {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" /> {/* Header */}
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (type === "form") {
    return (
      <Card>
        <CardContent className="pt-6 space-y-4">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-[100px]" /> {/* Label */}
              <Skeleton className="h-10 w-full" /> {/* Input */}
            </div>
          ))}
          <Skeleton className="h-10 w-[100px] mt-4" /> {/* Button */}
        </CardContent>
      </Card>
    );
  }

  if (type === "minimal") {
    return (
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    );
  }

  // Default card-based loading state
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-4 w-[200px]" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
