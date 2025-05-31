"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, Search } from "lucide-react";
import { signOut } from "next-auth/react";

import { useState } from "react";

export default function Header() {
  // Notification state
  const [notifications, setNotifications] = useState([
    {
      title: "New client pairing request",
      desc: "IP: 192.168.1.45",
      time: "Just now",
    },
    {
      title: "Game installation complete",
      desc: "Elden Ring is ready to play",
      time: "10m ago",
    },
    {
      title: "System update available",
      desc: "Version 2.4.1 is ready to install",
      time: "1h ago",
    },
  ]);

  // Handler to clear all notifications
  const handleClearAll = () => setNotifications([]);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-[rgba(255,255,255,0.1)] bg-[rgba(0,0,0,0.5)] backdrop-blur-md px-4 md:px-6 w-full">
      <div className="w-full flex-1 md:grow-0 md:w-auto">
        <Button
          variant="outline"
          className="border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] text-gray-400 hover:text-white hover:bg-[rgba(255,255,255,0.1)]"
          onClick={() => alert("Global search functionality coming soon!")}
        >
          <Search className="h-4 w-4 mr-2 text-[#01cdfe]" />
          <span className="hidden sm:inline">Search Platform</span>
        </Button>
      </div>

      <div className="ml-auto flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-gray-400">
              <Bell className="h-5 w-5" />
              <span className="sr-only">Notifications</span>
              {notifications.length > 0 && (
                <span className="absolute -mt-4 ml-2.5 rounded-full bg-[#00E5CC] px-1 py-0.5 text-xs font-medium text-white">
                  {notifications.length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-80 bg-[rgba(0,0,0,0.8)] backdrop-blur-md border-[rgba(255,255,255,0.1)] text-white"
          >
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[rgba(255,255,255,0.1)]" />
            {notifications.length === 0 ? (
              <div className="py-6 text-center text-gray-400 text-sm">
                No notifications
              </div>
            ) : (
              notifications.map((notification, i) => (
                <DropdownMenuItem
                  key={i}
                  className="flex flex-col items-start py-2 cursor-pointer hover:bg-[rgba(255,255,255,0.05)]"
                >
                  <p className="font-medium">{notification.title}</p>
                  <p className="text-xs text-gray-400">{notification.desc}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {notification.time}
                  </p>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator className="bg-[rgba(255,255,255,0.1)]" />
            <div className="flex justify-end px-2 py-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-[#00E5CC] hover:bg-[rgba(255,255,255,0.05)]"
                onClick={handleClearAll}
                disabled={notifications.length === 0}
              >
                Clear All
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar>
                <AvatarImage src="/placeholder-user.jpg" alt="User" />
                <AvatarFallback className="bg-[#0077B6] text-white">
                  AD
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            // Use default popover background/text/border, remove backdrop-blur and custom styles
            className="w-56"
          >
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[rgba(255,255,255,0.1)]" />
            <DropdownMenuItem
              asChild
              className="cursor-pointer hover:bg-[rgba(255,255,255,0.05)]"
            >
              <a href="/settings/account">Profile</a>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer hover:bg-[rgba(255,255,255,0.05)]">
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[rgba(255,255,255,0.1)]" />
            <DropdownMenuItem
              className="cursor-pointer text-[#0077B6] hover:bg-[rgba(255,255,255,0.05)]"
              onClick={async () => {
                try {
                  // Use NextAuth's built-in redirect functionality to avoid navigation conflicts
                  await signOut({
                    callbackUrl: "/login",
                    redirect: true
                  });
                } catch (error) {
                  console.error("Logout error:", error);
                  // Fallback: force navigation to login if signOut fails
                  window.location.href = "/login";
                }
              }}
            >
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
