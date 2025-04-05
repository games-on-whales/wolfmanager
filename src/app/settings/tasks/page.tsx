import { PageLayout } from "@/components/layout/page-layout";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import TaskListClient from "./_components/task-list-client"; // Import the client component

export default async function TasksSettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin"); // Redirect to signin if not logged in
  }

  if (session.user.role !== "admin") {
    redirect("/dashboard"); // Redirect to dashboard if not admin
  }

  return (
    <PageLayout
      title="Background Task Management"
      description="Monitor and manage scheduled background tasks."
    >
      <Suspense
        fallback={<div className="text-center p-4">Loading task list...</div>}
      >
        <TaskListClient />
      </Suspense>
    </PageLayout>
  );
}
