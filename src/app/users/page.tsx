import { ErrorBoundary } from "@/components/error-boundary";
import { PageLayout } from "@/components/layout/page-layout";
import { LoadingState } from "@/components/loading-state";
import { authOptions } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { UsersManagement } from "./components/users-management";

export default async function UsersPage() {
  // 1. Authentication
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "admin") redirect("/dashboard");

  // 2. Data Fetching from TOML
  const config = await getConfig();
  const users = Object.entries(config.users).map(([username, user]) => ({
    id: user.id,
    username: user.username,
    isAdmin: user.is_admin,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  }));

  // 3. Render with page layout
  return (
    <PageLayout
      title="User Management"
      description="Manage system users and permissions"
    >
      <ErrorBoundary>
        <Suspense fallback={<LoadingState />}>
          <UsersManagement initialUsers={users} />
        </Suspense>
      </ErrorBoundary>
    </PageLayout>
  );
}
