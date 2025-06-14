"use client";

import { WolfPageLayout } from "@/components/layout/wolf-page-layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import React, { useState, useMemo } from "react";

export interface SettingSection {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  disabled?: boolean;
}

export interface SettingGroup {
  title: string;
  sections: SettingSection[];
}

interface SettingsPageTemplateProps {
  title: string;
  description?: string;
  backHref?: string;
  sections?: SettingSection[];
  groups?: SettingGroup[];
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function SettingsPageTemplate({
  title,
  description,
  backHref,
  sections,
  groups,
  actions,
  children,
  className
}: SettingsPageTemplateProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Enhanced search keywords for better filtering
  const searchKeywords = {
    account: ["password", "reset", "login", "profile", "user", "authentication", "auth", "credentials"],
    "user management": ["users", "permissions", "roles", "access", "admin", "manage users"],
    "system logs": ["logs", "monitoring", "debug", "errors", "activity", "audit"],
    "api test": ["api", "endpoints", "testing", "rest", "webhook", "integration"],
    "wolf container logs": ["container", "docker", "wolf logs", "runtime"],
    "background tasks": ["tasks", "jobs", "background", "queue", "processing"],
    "metadata providers": ["metadata", "steamgriddb", "providers", "external"]
  };

  // Enhanced filter function with keyword matching
  const matchesSearch = (section: SettingSection, query: string) => {
    const lowerQuery = query.toLowerCase();
    const sectionTitle = section.title.toLowerCase();
    const sectionDesc = section.description.toLowerCase();
    
    // Direct title/description match
    if (sectionTitle.includes(lowerQuery) || sectionDesc.includes(lowerQuery)) {
      return true;
    }
    
    // Keyword matching
    const keywords = searchKeywords[sectionTitle as keyof typeof searchKeywords] || [];
    return keywords.some(keyword => keyword.includes(lowerQuery) || lowerQuery.includes(keyword));
  };

  // Filter sections based on enhanced search query
  const filteredGroups = useMemo(() => {
    if (!groups || !searchQuery.trim()) return groups;
    
    return groups.map(group => ({
      ...group,
      sections: group.sections.filter(section => matchesSearch(section, searchQuery))
    })).filter(group => group.sections.length > 0);
  }, [groups, searchQuery]);

  const filteredSections = useMemo(() => {
    if (!sections || !searchQuery.trim()) return sections;
    
    return sections.filter(section => matchesSearch(section, searchQuery));
  }, [sections, searchQuery]);

  // Search field component
  const searchField = (
    <div className="relative w-80">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
      <Input
        type="text"
        placeholder="Find settings..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="pl-10 bg-gray-800/50 border-gray-600 text-white placeholder-gray-400 focus:border-primary focus:ring-primary"
      />
    </div>
  );
  return (
    <WolfPageLayout
      title={title}
      description={description}
      backHref={backHref}
      actions={
        <div className="flex items-center gap-2">
          {searchField}
          {actions}
        </div>
      }
      className={className}
    >

      {/* Render grouped sections if provided */}
      {filteredGroups && filteredGroups.map((group, groupIndex) => (
        <React.Fragment key={groupIndex}>
          {/* Add separator bar between groups (not before first group) */}
          {groupIndex > 0 && (
            <div className="border-t border-gray-600 my-8" />
          )}
          <section className="space-y-6">
            {/* Group title with table header styling */}
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-white tracking-tight">{group.title}</h2>
              <p className="text-sm text-gray-400">
                {group.title === "Account Settings"
                  ? "Settings for your account"
                  : "Advanced settings for administrators"}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {group.sections.map((section, sectionIndex) => (
                <SettingCard
                  key={sectionIndex}
                  title={section.title}
                  description={section.description}
                  href={section.href}
                  icon={section.icon}
                  disabled={section.disabled}
                />
              ))}
            </div>
          </section>
        </React.Fragment>
      ))}
      
      {/* Render flat sections if provided (backward compatibility) */}
      {filteredSections && !groups && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSections.map((section, index) => (
            <SettingCard
              key={index}
              title={section.title}
              description={section.description}
              href={section.href}
              icon={section.icon}
              disabled={section.disabled}
            />
          ))}
        </div>
      )}
      
      {children}
    </WolfPageLayout>
  );
}

interface SettingCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export function SettingCard({
  title,
  description,
  href,
  icon,
  disabled = false,
  className
}: SettingCardProps) {
  const CardContent = (
    <Card className={cn(
      "glass-card p-6 transition-colors h-[100px]",
      disabled 
        ? "opacity-50 cursor-not-allowed" 
        : "cursor-pointer hover:bg-white/10",
      className
    )}>
      <div className="flex items-start space-x-4">
        <div className="bg-primary/10 p-3 rounded-lg">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {description}
          </p>
        </div>
      </div>
    </Card>
  );

  if (disabled) {
    return CardContent;
  }

  return (
    <Link href={href} className="block">
      {CardContent}
    </Link>
  );
}