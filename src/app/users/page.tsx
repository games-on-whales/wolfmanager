import { getUsers } from "./actions";
import { UsersManagement } from "./components/users-management";
import { UserErrorBoundary } from "./components/user-error-boundary";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

// Force dynamic rendering since this page uses server-side session data
export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const result = await getUsers();

  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to fetch users");
  }

  return (
    <div className="space-y-6 p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white neon-text">User Management</h1>
        </div>
      </div>
      <UserErrorBoundary>
        <UsersManagement initialUsers={result.data} />
      </UserErrorBoundary>
    </div>
  );
}
