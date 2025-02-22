"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { clientLogger, LogComponent } from "@/lib/logger";
import { Session } from "next-auth";
import { useRouter } from "next/navigation";

interface DashboardClientProps {
  session: Session;
}

export function DashboardClient({ session }: DashboardClientProps) {
  const router = useRouter();
  const username = session?.user?.name;

  // Format date consistently for both server and client
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  };

  clientLogger.info(LogComponent.WOLF_UI, "Dashboard loaded", {
    username: session?.user?.name,
    role: session?.user?.role,
  });

  return (
    <ProtectedRoute>
      <div className="container mx-auto py-10 space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {username}!</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>
                Manage system users and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1</div>
              <p className="text-xs text-muted-foreground">Active admin user</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
              <CardDescription>
                Current system status and health
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500"></div>
                <span className="text-sm font-medium">
                  All systems operational
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Frequently used actions</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {session?.user?.role === "admin" && (
                  <li>
                    <button
                      onClick={() => {
                        clientLogger.info(
                          LogComponent.WOLF_UI,
                          "Navigating to users page"
                        );
                        router.push("/users");
                      }}
                      className="text-sm text-blue-500 hover:underline cursor-pointer w-full text-left"
                    >
                      Add new user
                    </button>
                  </li>
                )}
                <li>
                  <button
                    onClick={() => {
                      clientLogger.info(
                        LogComponent.WOLF_UI,
                        "Navigating to system logs"
                      );
                      router.push("/settings");
                    }}
                    className="text-sm text-blue-500 hover:underline cursor-pointer w-full text-left"
                  >
                    View system logs
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      clientLogger.info(
                        LogComponent.WOLF_UI,
                        "Navigating to settings"
                      );
                      router.push("/settings");
                    }}
                    className="text-sm text-blue-500 hover:underline cursor-pointer w-full text-left"
                  >
                    Update settings
                  </button>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest actions in the system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 text-sm">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  <span className="text-muted-foreground">
                    System update completed successfully
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDate(new Date())}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
