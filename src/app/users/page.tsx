import { PageLayout } from "@/components/layout/page-layout";
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
      description="Manage system users and their roles"
    >
      <div className="space-y-6">
        <UsersManagement initialUsers={result.data} />
      </div>
    </PageLayout>
  );
}
