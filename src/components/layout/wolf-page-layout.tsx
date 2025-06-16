"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface WolfPageLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  backHref?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function WolfPageLayout({ 
  children, 
  title, 
  description, 
  backHref, 
  actions, 
  className 
}: WolfPageLayoutProps) {
  return (
    <div className={cn("space-y-6 p-8 max-w-7xl mx-auto", className)}>
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {backHref && (
            <Link href={backHref}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white neon-text">{title}</h1>
            {description && (
              <p className="text-gray-400 mt-1">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
      
      {/* Page Content */}
      {children}
    </div>
  );
}