import { PageLayout } from "@/components/layout/page-layout";
import { getUsers } from "./actions";
import { UsersManagement } from "./components/users-management";
import { UserErrorBoundary } from "./components/user-error-boundary";

// Force dynamic rendering since this page uses server-side session data
export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const result = await getUsers();

  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to fetch users");
  }

  return (
    <PageLayout
      title="User Management"
      description="Manage system users and their roles"
    >
      <UserErrorBoundary>
        <div className="space-y-6">
          <UsersManagement initialUsers={result.data} />
        </div>
      </UserErrorBoundary>
    </PageLayout>
  );
}
