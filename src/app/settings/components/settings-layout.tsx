"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface NavItem {
  id: string;
  label: string;
}

interface SettingsLayoutProps {
  title: string;
  description: string;
  navigation: NavItem[];
  children: React.ReactNode;
}

function useActiveSection() {
  const [activeSection, setActiveSection] = useState<string>("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        rootMargin: "-50% 0px -50% 0px",
      }
    );

    const sections = document.querySelectorAll("section[id]");
    sections.forEach((section) => observer.observe(section));

    return () => {
      sections.forEach((section) => observer.unobserve(section));
    };
  }, []);

  return activeSection;
}

export function SettingsLayout({
  title,
  description,
  navigation,
  children,
}: SettingsLayoutProps) {
  const activeSection = useActiveSection();

  return (
    <div className="container py-6 flex-1">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="flex gap-12">
        {/* Navigation Sidebar */}
        <div className="w-64 shrink-0">
          <div className="sticky top-24 space-y-1">
            {navigation.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={`block px-3 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors ${
                  activeSection === item.id
                    ? "bg-muted text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 max-w-2xl space-y-6 pb-12">{children}</div>
      </div>
    </div>
  );
}
