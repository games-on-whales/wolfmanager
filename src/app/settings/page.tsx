"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Key, LogOut, Search, Users, Webhook } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function SettingsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  return (
    <div className="container py-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your account settings</p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search settings..." className="pl-8" />
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
              <Card className="p-4 hover:bg-muted/50 transition-colors cursor-pointer h-[100px]">
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
              <Card className="p-4 hover:bg-muted/50 transition-colors cursor-pointer h-[100px]">
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
                <Card className="p-4 hover:bg-muted/50 transition-colors cursor-pointer h-[100px]">
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

              <Link href="/settings/api-test" className="block">
                <Card className="p-4 hover:bg-muted/50 transition-colors cursor-pointer h-[100px]">
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
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
