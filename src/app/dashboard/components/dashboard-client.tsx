"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LogComponent } from "@/lib/logger";
import { clientLogger } from "@/lib/logger/client";
import { showToast } from "@/lib/toast";
import { Session } from "next-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface DashboardClientProps {
  session: Session;
}

export function DashboardClient({ session }: DashboardClientProps) {
  const router = useRouter();
  const username = session?.user?.name;
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const logDashboardLoad = async () => {
      await clientLogger.info(LogComponent.WOLF_UI, "Dashboard loaded", {
        username,
        timestamp: new Date().toISOString(),
      });
    };
    logDashboardLoad();
  }, [username]);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    }).format(date);
  };

  const handleRefreshData = async () => {
    setIsLoading(true);
    try {
      await clientLogger.debug(
        LogComponent.WOLF_UI,
        "Refreshing dashboard data"
      );

      const response = await fetch("/api/dashboard/refresh", {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to refresh data");
      }

      await clientLogger.info(
        LogComponent.WOLF_UI,
        "Dashboard data refreshed successfully"
      );
      showToast.success("Data Refreshed", {
        description: "The dashboard data has been refreshed successfully",
      });
    } catch (error) {
      await clientLogger.error(
        LogComponent.WOLF_UI,
        "Failed to refresh dashboard data",
        error instanceof Error ? error : new Error(String(error))
      );
      showToast.error(
        "Refresh Failed",
        error instanceof Error
          ? error
          : new Error("Failed to refresh dashboard data")
      );
    } finally {
      setIsLoading(false);
    }
  };

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
