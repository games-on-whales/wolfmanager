import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import React from "react";

interface WolfContentCardProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

export function WolfContentCard({
  title,
  description,
  actions,
  children,
  className,
  headerClassName,
  contentClassName
}: WolfContentCardProps) {
  return (
    <Card className={cn("glass-card border-none", className)}>
      {(title || description || actions) && (
        <CardHeader className={cn("", headerClassName)}>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              {title && (
                <CardTitle className="text-white text-xl">{title}</CardTitle>
              )}
              {description && (
                <CardDescription className="text-gray-400 mt-1">
                  {description}
                </CardDescription>
              )}
            </div>
            {actions && (
              <div className="flex items-center gap-2 ml-4">
                {actions}
              </div>
            )}
          </div>
        </CardHeader>
      )}
      <CardContent className={cn("p-6", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}