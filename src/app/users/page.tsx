import { ErrorBoundary } from "@/components/error-boundary";
import { PageLayout } from "@/components/layout/page-layout";
import { LoadingState } from "@/components/loading-state";
import { Suspense } from "react";
import { getUsers } from "./actions";
import { UsersManagement } from "./components/users-management";

export default async function UsersPage() {
  const result = await getUsers();

  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to fetch users");
  }

  return (
    <PageLayout
      title="User Management"
      description="Manage system users and permissions"
    >
      <ErrorBoundary>
        <Suspense fallback={<LoadingState />}>
          <UsersManagement initialUsers={result.data} />
        </Suspense>
      </ErrorBoundary>
    </PageLayout>
  );
}
