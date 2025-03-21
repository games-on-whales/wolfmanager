import { PageLayout } from "@/components/layout/page-layout";
import { LoadingState } from "@/components/loading-state";

export default function UsersLoading() {
  return (
    <PageLayout title="User Management" description="Loading user data...">
      <LoadingState type="table" count={5} />
    </PageLayout>
  );
}
