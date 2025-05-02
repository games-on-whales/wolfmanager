"use client";

import { Card } from "@/components/ui/card";
import {
  Cpu,
  Database, // Add Database icon
  FileText,
  Key,
  LogOut,
  Terminal,
  Users,
  Webhook,
} from "lucide-react";
import Link from "next/link";
// Removed import for SteamGridDbSettings as it's moved

interface SettingsClientProps {
  user: {
    id: string;
    name: string;
    role?: string;
  };
}

export function SettingsClient({ user }: SettingsClientProps) {
  const isAdmin = user.role === "admin";

  return (
    <>
      <div className="p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
              Manage your account settings
            </p>
          </div>
        </div>

        <div className="space-y-8">
          {/* Account Settings Section */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Account Settings</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Settings for your account
            </p>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Link href="/settings/account" className="block">
                <Card className="glass-card p-6 transition-colors cursor-pointer h-[100px]">
                  <div className="flex items-start space-x-4">
                    <div className="bg-primary/10 p-3 rounded-lg">
                      <Key className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Account</h3>
                      <p className="text-sm text-muted-foreground">
                        Configure your account settings
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>

              <Link href="/settings/sessions" className="block">
                <Card className="glass-card p-6 transition-colors cursor-pointer h-[100px]">
                  <div className="flex items-start space-x-4">
                    <div className="bg-secondary/10 p-3 rounded-lg">
                      <LogOut className="h-5 w-5 text-secondary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Sessions</h3>
                      <p className="text-sm text-muted-foreground">
                        View and manage your active sessions
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            </div>
          </section>

          {/* Admin Settings Section */}
          {isAdmin && (
            <section>
              <h2 className="text-xl font-semibold mb-4">Admin Settings</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Advanced settings for administrators
              </p>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Link href="/users" className="block">
                  <Card className="glass-card p-6 transition-colors cursor-pointer h-[100px]">
                    <div className="flex items-start space-x-4">
                      <div className="bg-accent/10 p-3 rounded-lg">
                        <Users className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <h3 className="font-semibold">User Management</h3>
                        <p className="text-sm text-muted-foreground">
                          Manage system users and permissions
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>

                <Link href="/settings/logs" className="block">
                  <Card className="glass-card p-6 transition-colors cursor-pointer h-[100px]">
                    <div className="flex items-start space-x-4">
                      <div className="bg-accent/10 p-3 rounded-lg">
                        <FileText className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <h3 className="font-semibold">System Logs</h3>
                        <p className="text-sm text-muted-foreground">
                          View and analyze system logs
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>

                <Link href="/settings/api-test" className="block">
                  <Card className="glass-card p-6 transition-colors cursor-pointer h-[100px]">
                    <div className="flex items-start space-x-4">
                      <div className="bg-accent/10 p-3 rounded-lg">
                        <Webhook className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <h3 className="font-semibold">API Test</h3>
                        <p className="text-sm text-muted-foreground">
                          Test and verify API endpoints
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>

                <Link href="/settings/wolf-logs" className="block">
                  <Card className="glass-card p-6 transition-colors cursor-pointer h-[100px]">
                    <div className="flex items-start space-x-4">
                      <div className="bg-accent/10 p-3 rounded-lg">
                        <Terminal className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Wolf Container Logs</h3>
                        <p className="text-sm text-muted-foreground">
                          View and monitor Wolf container logs
                        </p>
                      </div>
                    </div>
                  </Card>
                  {/* SteamGridDbSettings component removed from here */}
                </Link>

                {process.env.NEXT_PUBLIC_FEATURE_BACKGROUND_TASKS_ENABLED ===
                  "true" && (
                  <Link href="/settings/tasks" className="block">
                    <Card className="glass-card p-6 transition-colors cursor-pointer h-[100px]">
                      <div className="flex items-start space-x-4">
                        <div className="bg-accent/10 p-3 rounded-lg">
                          <Cpu className="h-5 w-5 text-accent" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Background Tasks</h3>
                          <p className="text-sm text-muted-foreground">
                            Manage and monitor background processes
                          </p>
                        </div>
                      </div>
                    </Card>
                  </Link>
                )}

                {/* Moved Metadata Providers link here */}
                {process.env.NEXT_PUBLIC_FEATURE_GAME_LIBRARY_ENABLED ===
                  "true" && (
                  <Link href="/settings/metadata-providers" className="block">
                    <Card className="glass-card p-6 transition-colors cursor-pointer h-[100px]">
                      <div className="flex items-start space-x-4">
                        <div className="bg-accent/10 p-3 rounded-lg">
                          <Database className="h-5 w-5 text-accent" />{" "}
                          {/* Use Database icon */}
                        </div>
                        <div>
                          <h3 className="font-semibold">Metadata Providers</h3>
                          <p className="text-sm text-muted-foreground">
                            Configure external metadata sources like SteamGridDB
                          </p>
                        </div>
                      </div>
                    </Card>
                  </Link>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
