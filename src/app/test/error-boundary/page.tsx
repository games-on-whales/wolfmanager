import { PageLayout } from "@/components/layout/page-layout";
import { ErrorBoundaryTest } from "@/components/test/error-boundary-test";

export default function ErrorBoundaryTestPage() {
  return (
    <PageLayout
      title="Error Boundary Test"
      description="Test different error scenarios to verify error boundary functionality"
    >
      <ErrorBoundaryTest />
    </PageLayout>
  );
}
