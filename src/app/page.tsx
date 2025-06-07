import { LoadingSpinner } from "@/components/ui/loading";

export default function Home() {
  // The middleware handles all redirect logic for the root path
  // This component just shows a loading state while the middleware processes the request
  return <LoadingSpinner />;
}
