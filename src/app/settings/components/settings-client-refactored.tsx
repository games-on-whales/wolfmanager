"use client";

import { SettingsPageTemplate } from "@/components/wolf-ui";
import {
  Cpu,
  Database,
  FileText,
  Key,
  Terminal,
  Users,
  Webhook,
} from "lucide-react";

interface SettingsClientProps {
  user: {
    id: string;
    name: string;
    role?: string;
  };
}

export function SettingsClientRefactored({ user }: SettingsClientProps) {
  const isAdmin = user.role === "admin";

  // All settings sections as a flat array
  const allSections = [
    // Account settings
    {
      title: "Account",
      description: "Configure your account settings",
      href: "/settings/account",
      icon: <Key className="h-5 w-5" />,
    },
    // Admin settings (only if user is admin)
    ...(isAdmin
      ? [
          {
            title: "User Management",
            description: "Manage system users and permissions",
            href: "/users",
            icon: <Users className="h-5 w-5" />,
          },
          {
            title: "System Logs",
            description: "View and analyze system logs",
            href: "/settings/logs",
            icon: <FileText className="h-5 w-5" />,
          },
          {
            title: "API Test",
            description: "Test and verify API endpoints",
            href: "/settings/api-test",
            icon: <Webhook className="h-5 w-5" />,
          },
          {
            title: "Wolf Container Logs",
            description: "View and monitor Wolf container logs",
            href: "/settings/wolf-logs",
            icon: <Terminal className="h-5 w-5" />,
          },
          ...(process.env.NEXT_PUBLIC_FEATURE_BACKGROUND_TASKS_ENABLED === "true"
            ? [
                {
                  title: "Background Tasks",
                  description: "Manage and monitor background processes",
                  href: "/settings/tasks",
                  icon: <Cpu className="h-5 w-5" />,
                },
              ]
            : []),
          ...(process.env.NEXT_PUBLIC_FEATURE_GAME_LIBRARY_ENABLED === "true"
            ? [
                {
                  title: "Metadata Providers",
                  description: "Configure external metadata sources like SteamGridDB",
                  href: "/settings/metadata-providers",
                  icon: <Database className="h-5 w-5" />,
                },
              ]
            : []),
        ]
      : []),
  ];

  return (
    <SettingsPageTemplate
      title="Settings"
      description="Manage your account settings"
      sections={allSections}
    />
  );
}