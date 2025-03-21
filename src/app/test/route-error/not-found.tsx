import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <h2 className="text-xl font-semibold">Test Route Not Found</h2>
      <p className="text-sm text-muted-foreground">
        This is a simulated not-found error for testing purposes
      </p>
      <Button asChild>
        <Link href="/test/route-error">Try Again</Link>
      </Button>
    </div>
  );
}
