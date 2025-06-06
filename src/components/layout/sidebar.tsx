"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  GamepadIcon as GameController,
  Library,
  LogOut,
  Menu,
  Settings,
  Users,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Key for storing sidebar state in localStorage
const SIDEBAR_STATE_KEY = "wolf-sidebar-expanded";

export default function Sidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(true); // Default to expanded
  const [mobileOpen, setMobileOpen] = useState(false);

  // Load saved state on component mount
  useEffect(() => {
    const savedState = localStorage.getItem(SIDEBAR_STATE_KEY);
    if (savedState) {
      const { expanded: savedExpanded } = JSON.parse(savedState);
      setExpanded(savedExpanded);
    } else {
      // If no saved state, ensure the main content margin matches the default expanded state
      const mainContent = document.querySelector("div.md\\:ml-16");
      if (mainContent) {
        mainContent.classList.remove("md:ml-16");
        mainContent.classList.add("md:ml-64");
      }
    }
  }, []);

  // Save state when it changes
  useEffect(() => {
    localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify({ expanded }));
    // Dispatch custom event to notify header of sidebar state change
    window.dispatchEvent(new CustomEvent('sidebarStateChanged', { detail: { expanded } }));
  }, [expanded]);

  // Update the main content margin when sidebar state changes
  useEffect(() => {
    const mainContent = document.querySelector("div.md\\:ml-16");
    if (mainContent) {
      if (expanded) {
        mainContent.classList.remove("md:ml-16");
        mainContent.classList.add("md:ml-64");
      } else {
        mainContent.classList.remove("md:ml-64");
        mainContent.classList.add("md:ml-16");
      }
    }
  }, [expanded]);

  // Toggle expanded state
  const toggleSidebar = () => {
    setExpanded(!expanded);
  };

  // Toggle mobile sidebar
  const toggleMobileSidebar = () => {
    setMobileOpen(!mobileOpen);
  };

  // Conditionally include Game Library route based on feature flag
  const routes = [
    ...(process.env.NEXT_PUBLIC_FEATURE_GAME_LIBRARY_ENABLED === "true"
      ? [
          {
            name: "Game Library",
            path: "/dashboard/games",
            icon: Library,
          },
        ]
      : []),
    {
      name: "Clients",
      path: "/clients",
      icon: Users,
    },
    {
      name: "Settings",
      path: "/settings",
      icon: Settings,
    },
  ];

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden text-gray-400"
        onClick={toggleMobileSidebar}
      >
        <Menu className="h-6 w-6" />
      </Button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className="hidden md:block">
        <div
          className={cn(
            "fixed top-0 left-0 h-screen transition-all duration-300 ease-in-out z-30",
            expanded ? "w-64" : "w-16",
            "flex flex-col bg-[rgba(0,0,0,0.5)] backdrop-blur-md border-r border-[rgba(255,255,255,0.1)]"
          )}
        >
          {/* Logo Section */}
          <div className="p-4 flex items-center">
            <GameController className="h-8 w-8 text-[#00E5CC] flex-shrink-0" />
            <span
              className={cn(
                "text-xl font-bold text-white neon-text ml-2 transition-opacity duration-300",
                expanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
              )}
            >
              Wolf
            </span>
          </div>

          {/* Navigation Links */}
          <div className="flex-1 py-6 px-2 space-y-1 overflow-y-auto">
            {routes.map((route) => {
              const Icon = route.icon;
              const isActive =
                pathname === route.path ||
                (route.path === "/dashboard/settings" &&
                  pathname.startsWith("/dashboard/settings"));

              return (
                <Link key={route.path} href={route.path}>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start text-gray-400 hover:text-white hover:bg-[rgba(255,255,255,0.05)]",
                      isActive &&
                        "bg-[rgba(255,255,255,0.1)] text-[#01cdfe] neon-border",
                      expanded ? "px-4" : "px-0 justify-center"
                    )}
                  >
                    <Icon
                      className={cn("h-5 w-5", isActive && "text-[#01cdfe]")}
                    />
                    <span
                      className={cn(
                        "ml-2 transition-all duration-300",
                        expanded
                          ? "opacity-100"
                          : "opacity-0 w-0 overflow-hidden"
                      )}
                    >
                      {route.name}
                    </span>
                  </Button>
                </Link>
              );
            })}
          </div>

          {/* Logout Button */}
          <div className="border-t border-[rgba(255,255,255,0.1)] p-2">
            <Button
              variant="ghost"
              onClick={() => signOut()}
              className={cn(
                "w-full text-gray-400 hover:text-white hover:bg-[rgba(255,255,255,0.05)]",
                expanded ? "justify-start px-4" : "justify-center px-0"
              )}
            >
              <LogOut className="h-5 w-5" />
              <span
                className={cn(
                  "ml-2 transition-all duration-300",
                  expanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
                )}
              >
                Logout
              </span>
            </Button>
          </div>

          {/* Always visible toggle button */}
          <div className="border-t border-[rgba(255,255,255,0.1)] p-2">
            <Button
              variant="ghost"
              onClick={toggleSidebar}
              className={cn(
                "w-full text-gray-400 hover:text-white hover:bg-[rgba(255,255,255,0.05)]",
                expanded ? "justify-between px-4" : "justify-center px-0"
              )}
            >
              {expanded ? (
                <>
                  <span className="text-sm">Collapse</span>
                  <ChevronLeft className="h-5 w-5" />
                </>
              ) : (
                <ChevronRight className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-[rgba(0,0,0,0.8)] backdrop-blur-md border-r border-[rgba(255,255,255,0.1)] transition-transform duration-300 ease-in-out md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center">
            <GameController className="h-8 w-8 text-[#00E5CC]" />
            <span className="text-xl font-bold text-white neon-text ml-2">
              Wolf
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white"
            onClick={() => setMobileOpen(false)}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>

        <div className="py-6 px-4 space-y-1">
          {routes.map((route) => {
            const Icon = route.icon;
            const isActive =
              pathname === route.path ||
              (route.path === "/dashboard/settings" &&
                pathname.startsWith("/dashboard/settings"));

            return (
              <Link
                key={route.path}
                href={route.path}
                onClick={() => setMobileOpen(false)}
              >
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-gray-400 hover:text-white hover:bg-[rgba(255,255,255,0.05)]",
                    isActive &&
                      "bg-[rgba(255,255,255,0.1)] text-[#01cdfe] neon-border"
                  )}
                >
                  <Icon
                    className={cn("mr-2 h-5 w-5", isActive && "text-[#01cdfe]")}
                  />
                  {route.name}
                </Button>
              </Link>
            );
          })}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[rgba(255,255,255,0.1)]">
          <Button
            variant="ghost"
            onClick={() => signOut()}
            className="w-full justify-start text-gray-400 hover:text-white hover:bg-[rgba(255,255,255,0.05)]"
          >
            <LogOut className="mr-2 h-5 w-5" />
            Logout
          </Button>
        </div>
      </div>
    </>
  );
}
