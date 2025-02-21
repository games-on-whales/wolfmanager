import { authOptions } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
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

  // 3. Render client component with data
  return <UsersManagement initialUsers={users} />;
}
