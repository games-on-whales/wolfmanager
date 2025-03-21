import { PageLayout } from "@/components/layout/page-layout";
import { LoadingState } from "@/components/loading-state";

export default function SettingsLoading() {
  return (
    <PageLayout title="Settings" description="Loading your settings...">
      <LoadingState />
    </PageLayout>
  );
}
