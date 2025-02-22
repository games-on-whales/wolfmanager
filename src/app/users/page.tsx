import { ErrorBoundary } from "@/components/error-boundary";
import { PageLayout } from "@/components/layout/page-layout";
import { LoadingState } from "@/components/loading-state";
import { authOptions } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { LogComponent, logger } from "@/lib/logger";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { UsersManagement } from "./components/users-management";

export default async function UsersPage() {
  // 1. Authentication
  const session = await getServerSession(authOptions);

  await logger.info(LogComponent.AUTH, "User management page access attempt", {
    userId: session?.user?.id,
    username: session?.user?.name,
  });

  if (!session?.user) {
    await logger.warn(
      LogComponent.AUTH,
      "Unauthorized access to user management",
      {
        redirectTo: "/auth/signin",
      }
    );
    redirect("/auth/signin");
  }

  if (session.user.role !== "admin") {
    await logger.warn(
      LogComponent.AUTH,
      "Non-admin access attempt to user management",
      {
        userId: session.user.id,
        username: session.user.name,
        role: session.user.role,
        redirectTo: "/dashboard",
      }
    );
    redirect("/dashboard");
  }

  try {
    // 2. Data Fetching from TOML
    const config = await getConfig();
    const users = Object.entries(config.users).map(([username, user]) => ({
      id: user.id,
      username: user.username,
      isAdmin: user.is_admin,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    }));

    await logger.info(LogComponent.WOLF_UI, "User list fetched", {
      userCount: users.length,
      adminCount: users.filter((u) => u.isAdmin).length,
    });

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
  } catch (error) {
    await logger.error(
      LogComponent.WOLF_UI,
      "Failed to load user management page",
      error,
      { userId: session.user.id }
    );
    throw error;
  }
}
